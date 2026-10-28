import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CommandContext } from "../context.ts";
import { CliError, NotInteractiveError, UsageError } from "../errors.ts";
import { scriptedPrompter, type ScriptedAnswer } from "../prompts/prompter.ts";
import { storePaths, type StorePaths } from "../storage/paths.ts";
import { initStore, loadStore } from "../storage/store-file.ts";
import { runImport } from "./import.ts";

const FIXTURES = fileURLToPath(new URL("../../../../fixtures/synthetic-financial-data/csv/", import.meta.url));
const NOW = new Date("2026-10-28T10:00:00.000Z");

/** Delimiter, date column and format, description, layout, amount column, sign, then no ID, currency or reference. */
const SIGNED_MAPPING: ScriptedAnswer[] = [null, "Date", "YYYY-MM-DD", "Description", "signed", "Amount", "negative", "", "", ""];
const COMPLETE_OCT_1_10: ScriptedAnswer[] = ["complete", "2026-10-01", "2026-10-10"];

let root: string;
let paths: StorePaths;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "kakeibo-import-"));
  paths = storePaths(root);
  await initStore(paths, NOW.toISOString());
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function makeContext(answers: readonly ScriptedAnswer[], interactive = true) {
  const out: string[] = [];
  const err: string[] = [];
  const prompter = scriptedPrompter(answers);
  const context: CommandContext = {
    paths,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    now: () => NOW,
    interactive,
    prompter,
  };
  return { context, out, err, prompter };
}

async function importA(): Promise<void> {
  await runImport(makeContext([...SIGNED_MAPPING, ...COMPLETE_OCT_1_10, true]).context, `${FIXTURES}overlap-a.csv`, { account: "current" });
}

describe("import (interactive)", () => {
  it("maps a first file, previews it and creates the account, mapping and unreviewed entries together", async () => {
    const { context, out, prompter } = makeContext([...SIGNED_MAPPING, ...COMPLETE_OCT_1_10, true]);
    await runImport(context, `${FIXTURES}overlap-a.csv`, { account: "current" });
    const text = out.join("\n");
    expect(text).toContain("Account 'current' does not exist yet. It will be created when you confirm this import.");
    expect(text).toContain("Account: current (new; created with this import)");
    expect(text).toContain("Mapping: new version 1 (saved with this import)");
    expect(text).toContain("Amount sign: in 'Amount', negative amounts are money out and positive amounts are money in");
    expect(text).toContain("Currency: the file has no currency column; every amount will be recorded as GBP.");
    expect(text).toContain("Rows are posted from 2026-10-01 to 2026-10-09.");
    expect(text).toContain("Coverage: complete for 2026-10-01 to 2026-10-10 (your declaration)");
    expect(text).toContain("Reused 0 · New 6 · Needs decision 0 · Duplicate candidates 0");
    expect(text).toContain("Imported overlap-a.csv into 'current' as imp_001: 6 new unreviewed entries, 0 reused.");
    expect(prompter.asked.at(-1)).toBe("Import 6 row(s) into 'current' (6 new, 0 reused)?");

    const store = await loadStore(paths);
    expect(store.accounts.map((account) => account.name)).toEqual(["current"]);
    expect(store.mappings).toHaveLength(1);
    expect(store.imports[0]).toMatchObject({ file_name: "overlap-a.csv", row_count: 6 });
    expect(store.entries).toHaveLength(6);
    expect(store.entries.every((entry) => entry.review_state === "unreviewed")).toBe(true);
  });

  it("reuses the saved mapping and asks only for coverage and confirmation", async () => {
    await importA();
    const { context, out, prompter } = makeContext(["complete", "2026-10-01", "2026-10-15", true]);
    await runImport(context, `${FIXTURES}overlap-b-reordered.csv`, { account: "Current" });
    expect(prompter.asked).toHaveLength(4);
    const text = out.join("\n");
    expect(text).toContain("Using saved mapping version 1 for 'current'.");
    expect(text).toContain("Reused 6 · New 2 · Needs decision 0 · Duplicate candidates 0");
    expect((await loadStore(paths)).entries).toHaveLength(8);
  });

  it("recognises an exact reimport and changes nothing", async () => {
    await importA();
    const before = await fs.readFile(paths.store, "utf8");
    const { context, out, prompter } = makeContext([]);
    await runImport(context, `${FIXTURES}overlap-a.csv`, { account: "current" });
    expect(prompter.asked).toEqual([]);
    expect(out.at(-1)).toBe("overlap-a.csv was already imported into 'current' as imp_001 on 2026-10-28T10:00:00.000Z. Nothing to import. No data was changed.");
    expect(await fs.readFile(paths.store, "utf8")).toBe(before);
  });

  it("asks for a bulk decision with per-row overrides on a filtered export", async () => {
    await importA();
    const { context, out } = makeContext(["partial", "reuse", ["7"], true]);
    await runImport(context, `${FIXTURES}overlap-b-reordered.csv`, { account: "current" });
    const text = out.join("\n");
    expect(text).toContain("Needs decision 6");
    expect(text).toContain("Reused 5 · New 3 · Needs decision 0 · Duplicate candidates 1");
    const store = await loadStore(paths);
    expect(store.entries.filter((entry) => entry.duplicate !== undefined).map((entry) => entry.duplicate?.of_entry_id)).toEqual(["tx_004"]);
  });

  it("shows flagged dates and names the kept entries in the confirmation", async () => {
    await importA();
    const { context, out, prompter } = makeContext([...COMPLETE_OCT_1_10, true]);
    await runImport(context, `${FIXTURES}overlap-reduced.csv`, { account: "current" });
    expect(out.join("\n")).toContain("  2026-10-05: not in this file: tx_004");
    expect(prompter.asked.at(-1)).toBe("Import 4 row(s) into 'current' (0 new, 4 reused, keeping 2 existing entries this file does not contain)?");
    expect((await loadStore(paths)).imports[1]?.discrepancies).toHaveLength(2);
  });

  it("shows retained and incoming values for changed-value proposals before any decision", async () => {
    await importA();
    const { context, out, prompter } = makeContext([...COMPLETE_OCT_1_10, "reuse", [], true]);
    await runImport(context, `${FIXTURES}overlap-changed.csv`, { account: "current" });
    const firstPreview = out.find((line) => line.startsWith("Import preview")) ?? "";
    expect(firstPreview).toContain("Changed values (retained entry → incoming row):");
    expect(firstPreview).toContain("  Row 2: tx_002 2026-10-02 Tesco Stores -£50.00 → 2026-10-02 Tesco Stores -£55.00");
    expect(firstPreview).toContain("  Row 5: tx_005 2026-10-07 Waterstones -£20.00 → 2026-10-07 WATERSTONES LTD -£20.00");
    expect(prompter.asked.at(-1)).toBe("Import 6 row(s) into 'current' (0 new, 6 reused)?");
    expect((await loadStore(paths)).entries.find((entry) => entry.id === "tx_002")?.source.amount).toBe(5500);
  });

  it("re-asks a coverage range that excludes rows", async () => {
    const { context, err } = makeContext([...SIGNED_MAPPING, "complete", "2026-10-02", "2026-10-10", "2026-10-01", "2026-10-31", true]);
    await runImport(context, `${FIXTURES}overlap-a.csv`, { account: "current" });
    expect(err).toEqual(["Rows are posted from 2026-10-01 to 2026-10-09, outside 2026-10-02 to 2026-10-10. Enter a range that includes every row."]);
    expect((await loadStore(paths)).imports[0]?.coverage).toEqual({ completeness: "complete", from: "2026-10-01", to: "2026-10-31", basis: "user_declaration" });
  });

  it("requires --remap when the saved mapping no longer fits, and saves a new version with it", async () => {
    await importA();
    const before = await fs.readFile(paths.store, "utf8");
    const refused = await runImport(makeContext([]).context, `${FIXTURES}changed-mapping.csv`, { account: "current" }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(CliError);
    expect((refused as CliError).fullMessage).toContain("missing column(s) 'Date', 'Description', 'Amount'. If the export format changed, run the command again with --remap. No data was changed.");
    expect(await fs.readFile(paths.store, "utf8")).toBe(before);

    const remap: ScriptedAnswer[] = [";", "Posted", "DD/MM/YYYY", "Narrative", "signed", "Value", "negative", "", "", ""];
    const { context, out } = makeContext([...remap, ...COMPLETE_OCT_1_10, "keep_separate", [], true]);
    await runImport(context, `${FIXTURES}changed-mapping.csv`, { account: "current", remap: true });
    expect(out.join("\n")).toContain("Mapping: new version 2 (saved with this import)");
    expect(out.join("\n")).toContain("earlier coverage used an incompatible mapping");
    const store = await loadStore(paths);
    expect(store.mappings.map((mapping) => mapping.version)).toEqual([1, 2]);
    expect(store.imports[1]?.mapping_id).toBe("map_002");
  });

  it("re-asks the mapping when a column is chosen twice", async () => {
    const twice: ScriptedAnswer[] = [null, "Date", "YYYY-MM-DD", "Date", "signed", "Amount", "negative", "", "", ""];
    const { context, err } = makeContext([...twice, ...SIGNED_MAPPING, ...COMPLETE_OCT_1_10, true]);
    await runImport(context, `${FIXTURES}overlap-a.csv`, { account: "current" });
    expect(err).toEqual(["Each column can be used once; 'Date' was chosen more than once. Map the columns again."]);
    expect((await loadStore(paths)).mappings[0]?.description_column).toBe("Description");
  });

  it("maps a semicolon card export with a currency column", async () => {
    const card: ScriptedAnswer[] = [null, "Transaction date", "DD/MM/YYYY", "Merchant", "signed", "Amount", "positive", "", "Currency", ""];
    const { context, out } = makeContext([...card, "unknown", true]);
    await runImport(context, `${FIXTURES}credit-card-positive-out.csv`, { account: "card" });
    expect(out.join("\n")).toContain("Currency: GBP, checked in column 'Currency'.");
    const store = await loadStore(paths);
    expect(store.entries.map((entry) => [entry.movement, entry.source.amount])).toEqual([
      ["outflow", 320],
      ["outflow", 1299],
      ["inflow", 15000],
    ]);
  });

  it("aborts on conflicting source IDs without changing data", async () => {
    const ids: ScriptedAnswer[] = [null, "Date", "YYYY-MM-DD", "Description", "signed", "Amount", "negative", "Id", "", ""];
    await runImport(makeContext([...ids, "unknown", true]).context, `${FIXTURES}with-ids.csv`, { account: "current" });
    const before = await fs.readFile(paths.store, "utf8");
    const { context, err } = makeContext(["unknown"]);
    const error = await runImport(context, `${FIXTURES}with-ids-conflict.csv`, { account: "current" }).catch((caught: unknown) => caught);
    expect((error as CliError).fullMessage).toBe("Import aborted: source IDs conflict with earlier imports, and history is never overwritten. No data was changed.");
    expect(err).toEqual(["Row 2 (line 3): source ID 'T-1002' was imported before as src_002 (entry tx_002) with different amount."]);
    expect(await fs.readFile(paths.store, "utf8")).toBe(before);
  });

  it("reports every invalid row before any coverage question", async () => {
    const { context, err, prompter } = makeContext(SIGNED_MAPPING);
    const error = await runImport(context, `${FIXTURES}invalid-rows.csv`, { account: "current" }).catch((caught: unknown) => caught);
    expect((error as CliError).fullMessage).toBe("Import aborted: invalid-rows.csv has 4 invalid value(s). Fix the file or the mapping and run it again. No data was changed.");
    expect(err).toHaveLength(4);
    expect(prompter.asked).toHaveLength(SIGNED_MAPPING.length);
  });

  it("refuses without a terminal or an account name", async () => {
    const error = await runImport(makeContext([], false).context, `${FIXTURES}overlap-a.csv`, { account: "current" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NotInteractiveError);
    expect((error as CliError).fullMessage).toContain("No data was changed.");
    await expect(runImport(makeContext([]).context, `${FIXTURES}overlap-a.csv`, { account: "  " })).rejects.toBeInstanceOf(UsageError);
    expect((await loadStore(paths)).accounts).toEqual([]);
  });
});
