import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findEntry, type Entry, type Store } from "@kakeibo/domain";
import type { CommandContext } from "../context.ts";
import { CliError, NotInteractiveError } from "../errors.ts";
import { scriptedPrompter, type ScriptedAnswer } from "../prompts/prompter.ts";
import { storePaths, type StorePaths } from "../storage/paths.ts";
import { initStore, loadStore } from "../storage/store-file.ts";
import { runEdit } from "./edit.ts";
import { runImport } from "./import.ts";

const FIXTURES = fileURLToPath(new URL("../../../../fixtures/synthetic-financial-data/csv/", import.meta.url));
const NOW = new Date("2026-10-28T10:00:00.000Z");
const SIGNED_MAPPING: ScriptedAnswer[] = [null, "Date", "YYYY-MM-DD", "Description", "signed", "Amount", "negative", "", "", ""];

let root: string;
let paths: StorePaths;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "kakeibo-edit-"));
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
  const context: CommandContext = { paths, out: (line) => out.push(line), err: (line) => err.push(line), now: () => NOW, interactive, prompter };
  return { context, out, err, prompter };
}

/** overlap-a.csv (tx_001–tx_006) declared complete, then a reordered complete superset that reuses all six. */
async function importOverlapping(): Promise<void> {
  await runImport(makeContext([...SIGNED_MAPPING, "complete", "2026-10-01", "2026-10-10", true]).context, `${FIXTURES}overlap-a.csv`, { account: "current" });
  await runImport(makeContext(["complete", "2026-10-01", "2026-10-15", true]).context, `${FIXTURES}overlap-b-reordered.csv`, { account: "current" });
}

function entry(store: Store, id: string): Entry {
  return findEntry(store, id) as Entry;
}

describe("edit", () => {
  it("needs a terminal and a known entry ID, and changes nothing otherwise", async () => {
    await expect(runEdit(makeContext([], false).context, "tx_001")).rejects.toBeInstanceOf(NotInteractiveError);
    const before = await fs.readFile(paths.store, "utf8");
    const error = await runEdit(makeContext([]).context, "tx_404").catch((caught: unknown) => caught);
    expect((error as CliError).fullMessage).toBe("No entry tx_404. Entry IDs appear in `kakeibo review --show`. No data was changed.");
    expect(await fs.readFile(paths.store, "utf8")).toBe(before);
  });

  it("shows the entry's source observations, including rows that reused it", async () => {
    await importOverlapping();
    const { context, out } = makeContext(["done"]);
    await runEdit(context, " TX_002 ");
    const text = out.join("\n");
    expect(text).toContain("Entry tx_002 (revision 1)\nAccount: current\nPosted: 2026-10-02\nDescription: Tesco Stores\nAmount: -£50.00 (money out)");
    expect(text).toContain("src_002: imp_001 overlap-a.csv row 2 (line 3), created this entry\n    raw: Date=2026-10-02, Description=Tesco Stores, Amount=-50.00");
    expect(text).toMatch(/src_\d+: imp_002 overlap-b-reordered\.csv row \d+ \(line \d+\), reused \(counted occurrence\)/);
  });

  it("reverses an incorrect reuse into a separate unreviewed entry and keeps the retained entry", async () => {
    await importOverlapping();
    const before = await loadStore(paths);
    const reused = before.source_records.find((source) => source.import_id === "imp_002" && source.entry_id === "tx_002");
    const { context, out, err } = makeContext(["reverse", reused?.id as string, true, "done"]);
    await runEdit(context, "tx_002");
    expect(err).toEqual([]);
    const created = `tx_00${before.entries.length + 1}`;
    expect(out.join("\n")).toContain(`Saved: ${reused?.id} now belongs to new unreviewed entry ${created}.`);
    const store = await loadStore(paths);
    expect(entry(store, "tx_002")).toEqual(entry(before, "tx_002"));
    expect(entry(store, created)).toMatchObject({ source: { description: "Tesco Stores" }, review_state: "unreviewed" });
    expect(store.source_records.find((source) => source.id === reused?.id)?.match).toEqual({ basis: "reuse_reversed", reversed_from_entry_id: "tx_002" });
    expect(out.join("\n")).toContain(`Reversed source rows (now separate entries):\n  ${reused?.id} → ${created}`);
  });

  it("marks an entry as a duplicate of another, rejects a self reference and reverses the decision as unreviewed", async () => {
    await importOverlapping();
    const self = makeContext(["duplicate", "exclude_other", "tx_004", "done"]);
    await runEdit(self.context, "tx_004");
    expect(self.err).toEqual(["tx_004 cannot be a duplicate of itself."]);
    expect(self.out).toContain("Nothing was saved.");

    await runEdit(makeContext(["duplicate", "exclude_other", "tx_003", true, "done"]).context, "tx_004");
    expect(entry(await loadStore(paths), "tx_004")).toMatchObject({ duplicate: { status: "excluded", of_entry_id: "tx_003" }, review_state: "reviewed" });

    const chain = makeContext(["duplicate", "exclude_other", "tx_004", "done"]);
    await runEdit(chain.context, "tx_003");
    expect(chain.err).toEqual([
      "tx_003 is excluded as a duplicate of tx_004, which is itself excluded as a duplicate of tx_003; no retained entry would remain.",
      "tx_004 is excluded as a duplicate of tx_003, which is itself excluded as a duplicate of tx_004; no retained entry would remain.",
    ]);
    expect(entry(await loadStore(paths), "tx_003").duplicate).toBeUndefined();

    await runEdit(makeContext(["duplicate", true, "done"]).context, "tx_004");
    expect(entry(await loadStore(paths), "tx_004")).toMatchObject({ duplicate: { status: "candidate", of_entry_id: "tx_003" }, review_state: "unreviewed" });
  });

  it("confirms an entry and corrects it with a new category created in the same save", async () => {
    await importOverlapping();
    const { context, out } = makeContext(["confirm", ["tx_005"], true, true, "classify", "spending", "culture", "__new__", "Magazines", "reviewed", "done"]);
    await runEdit(context, "tx_005");
    expect(out.join("\n")).toContain("Spending, Unclassified / Uncategorised → Spending, Culture / Magazines (new)");
    const store = await loadStore(paths);
    const magazines = store.categories.find((category) => category.name === "Magazines");
    expect(entry(store, "tx_005")).toMatchObject({ treatment: "culture", category_id: magazines?.id, review_state: "reviewed", revision: 3 });
    expect(store.history.map((record) => record.kind)).toEqual(["entry_confirmed", "category_created", "entry_classified"]);
  });
});
