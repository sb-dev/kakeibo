import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addPlanRevision,
  createEmptyStore,
  currentPlanRevision,
  pence,
  savingsGoal,
  validatePlan,
  type Month,
  type Store,
} from "@kakeibo/domain";
import { runEdit } from "../commands/edit.ts";
import { runImport } from "../commands/import.ts";
import { runReview } from "../commands/review.ts";
import { runSpending } from "../commands/spending.ts";
import { runSummary } from "../commands/summary.ts";
import type { CommandContext } from "../context.ts";
import { CliError, CorruptStoreError, LockHeldError, StoreExistsError, StoreMissingError } from "../errors.ts";
import { scriptedPrompter, type ScriptedAnswer } from "../prompts/prompter.ts";
import { storePaths, type StorePaths } from "./paths.ts";
import { initStore, loadStore, updateStore } from "./store-file.ts";

const NOW = "2026-10-28T10:00:00.000Z";
const OCTOBER = "2026-10" as Month;
const isWindows = process.platform === "win32";

let root: string;
let paths: StorePaths;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "kakeibo-storage-"));
  paths = storePaths(path.join(root, "data"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function savePrdPlan(store: Store, income = 50000) {
  const goal = savingsGoal(store);
  const validated = validatePlan({
    planning_income: pence(income),
    fixed_commitments: pence(10000),
    plan_funded_goal_allocations: [{ goal_id: goal.id, amount: pence(10000) }],
    envelopes: { needs: pence(income - 20000 - 15000), wants: pence(10000), culture: pence(2500), unexpected: pence(2500) },
    intention: "Cook at home",
  });
  if (!validated.ok) throw new Error("fixture must validate");
  const result = addPlanRevision(store, OCTOBER, validated.value, NOW);
  return { store: result.store, result: result.revision };
}

async function mode(file: string): Promise<number> {
  return (await fs.stat(file)).mode & 0o777;
}

async function listDir(): Promise<string[]> {
  return (await fs.readdir(paths.dir)).sort();
}

describe("init", () => {
  it("creates the directory and store with restrictive permissions and seeded data", async () => {
    const store = await initStore(paths, NOW);
    expect(store.goals.map((goal) => goal.name)).toEqual(["Savings"]);
    expect(store.categories.length).toBeGreaterThan(0);
    expect(await listDir()).toEqual(["store.json"]);
    if (!isWindows) {
      expect(await mode(paths.dir)).toBe(0o700);
      expect(await mode(paths.store)).toBe(0o600);
    }
    const loaded = await loadStore(paths);
    expect(loaded).toEqual(store);
  });

  it("refuses to replace an existing store and leaves it byte-identical", async () => {
    await initStore(paths, NOW);
    await fs.writeFile(paths.store, "{ not even json", "utf8");
    const before = await fs.readFile(paths.store, "utf8");
    await expect(initStore(paths, "2026-10-29T00:00:00.000Z")).rejects.toBeInstanceOf(StoreExistsError);
    expect(await fs.readFile(paths.store, "utf8")).toBe(before);
    expect(await listDir()).toEqual(["store.json"]);
  });
});

describe("save and load", () => {
  it("round-trips a plan revision and restarts from disk", async () => {
    await initStore(paths, NOW);
    const revision = await updateStore(paths, savePrdPlan);
    expect(revision.revision).toBe(1);
    const reloaded = await loadStore(paths);
    expect(currentPlanRevision(reloaded, OCTOBER)).toEqual(revision);
    expect(reloaded.history).toHaveLength(1);
    expect(await listDir()).toEqual(["store.json", "store.json.bak"]);
  });

  it("fails when no store exists", async () => {
    await expect(loadStore(paths)).rejects.toBeInstanceOf(StoreMissingError);
    await expect(updateStore(paths, savePrdPlan)).rejects.toBeInstanceOf(StoreMissingError);
  });

  it("keeps the previous valid store as store.json.bak on every save", async () => {
    await initStore(paths, NOW);
    const initial = await fs.readFile(paths.store, "utf8");
    await updateStore(paths, savePrdPlan);
    expect(await fs.readFile(paths.backup, "utf8")).toBe(initial);
    const afterFirst = await fs.readFile(paths.store, "utf8");
    await updateStore(paths, (store) => savePrdPlan(store, 60000));
    expect(await fs.readFile(paths.backup, "utf8")).toBe(afterFirst);
    if (!isWindows) {
      expect(await mode(paths.backup)).toBe(0o600);
      expect(await mode(paths.store)).toBe(0o600);
    }
    const reloaded = await loadStore(paths);
    expect(currentPlanRevision(reloaded, OCTOBER)?.revision).toBe(2);
  });

  it("removes orphaned temporary files left by an interrupted save", async () => {
    await initStore(paths, NOW);
    await fs.writeFile(path.join(paths.dir, "store.json.tmp-999-deadbeef"), "partial", "utf8");
    await updateStore(paths, savePrdPlan);
    expect(await listDir()).toEqual(["store.json", "store.json.bak"]);
  });
});

describe("corrupt and unsupported stores", () => {
  it("rejects invalid JSON without writing anything", async () => {
    await initStore(paths, NOW);
    await updateStore(paths, savePrdPlan);
    const goodBackup = await fs.readFile(paths.backup, "utf8");
    await fs.writeFile(paths.store, "{ definitely not json", "utf8");

    await expect(loadStore(paths)).rejects.toBeInstanceOf(CorruptStoreError);
    await expect(updateStore(paths, savePrdPlan)).rejects.toBeInstanceOf(CorruptStoreError);
    expect(await fs.readFile(paths.store, "utf8")).toBe("{ definitely not json");
    expect(await fs.readFile(paths.backup, "utf8")).toBe(goodBackup);
    expect(await listDir()).toEqual(["store.json", "store.json.bak"]);
  });

  it("rejects an unsupported schema version and points at the backup", async () => {
    await initStore(paths, NOW);
    const newer = { ...createEmptyStore(NOW), schema_version: 2 };
    await fs.writeFile(paths.store, JSON.stringify(newer), "utf8");
    const error = await loadStore(paths).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CorruptStoreError);
    expect((error as CorruptStoreError).message).toContain("schema version 2 is newer");
    expect((error as CorruptStoreError).message).toContain(paths.backup);
    expect((error as CorruptStoreError).dataChanged).toBe(false);
  });

  it("recovers when the user copies the backup back over the store", async () => {
    await initStore(paths, NOW);
    await updateStore(paths, savePrdPlan);
    const beforeCorruption = await loadStore(paths);
    await updateStore(paths, (store) => savePrdPlan(store, 60000));
    await fs.writeFile(paths.store, "corrupt", "utf8");

    await fs.rename(paths.store, path.join(paths.dir, "store.json.corrupt"));
    await fs.copyFile(paths.backup, paths.store);

    const recovered = await loadStore(paths);
    expect(recovered).toEqual(beforeCorruption);
    expect(currentPlanRevision(recovered, OCTOBER)?.revision).toBe(1);
  });

  it("rejects a hand-edited plan that no longer balances and leaves store and backup unchanged", async () => {
    await initStore(paths, NOW);
    await updateStore(paths, savePrdPlan);
    const backupBefore = await fs.readFile(paths.backup, "utf8");
    const edited = JSON.parse(await fs.readFile(paths.store, "utf8")) as { plans: { revisions: { envelopes: { needs: number } }[] }[] };
    edited.plans[0]!.revisions[0]!.envelopes.needs = 1;
    const editedText = JSON.stringify(edited, null, 2);
    await fs.writeFile(paths.store, editedText, "utf8");

    const error = await loadStore(paths).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CorruptStoreError);
    expect((error as CorruptStoreError).message).toContain("Envelopes total");
    await expect(updateStore(paths, (store) => savePrdPlan(store, 60000))).rejects.toBeInstanceOf(CorruptStoreError);
    expect(await fs.readFile(paths.store, "utf8")).toBe(editedText);
    expect(await fs.readFile(paths.backup, "utf8")).toBe(backupBefore);
    expect(await listDir()).toEqual(["store.json", "store.json.bak"]);
  });

  it("refuses to save a store that fails validation after mutation", async () => {
    await initStore(paths, NOW);
    const before = await fs.readFile(paths.store, "utf8");
    await expect(
      updateStore(paths, (store) => ({ store: { ...store, currency: "EUR" } as unknown as Store, result: undefined })),
    ).rejects.toThrow(/Refusing to save/);
    expect(await fs.readFile(paths.store, "utf8")).toBe(before);
    expect(await listDir()).toEqual(["store.json"]);
  });
});

describe("writer contention", () => {
  it("rejects a second writer while store.lock exists and changes nothing", async () => {
    await initStore(paths, NOW);
    const before = await fs.readFile(paths.store, "utf8");
    const lockBody = `${JSON.stringify({ pid: 4242, acquired_at: NOW, hostname: "other-host" })}\n`;
    await fs.writeFile(paths.lock, lockBody, "utf8");

    const error = await updateStore(paths, savePrdPlan).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LockHeldError);
    expect((error as LockHeldError).message).toContain("pid 4242");
    expect((error as LockHeldError).message).toContain("other-host");
    expect((error as LockHeldError).fullMessage).toContain("No data was changed.");
    expect(await fs.readFile(paths.store, "utf8")).toBe(before);
    expect(await fs.readFile(paths.lock, "utf8")).toBe(lockBody);
    expect(await listDir()).toEqual(["store.json", "store.lock"]);
  });

  it("lets exactly one of two concurrent writers succeed and keeps the store valid", async () => {
    await initStore(paths, NOW);
    const slowMutation = (store: Store) => {
      const end = Date.now() + 50;
      while (Date.now() < end) {
        // hold the lock briefly so the second writer overlaps
      }
      return savePrdPlan(store);
    };
    const outcomes = await Promise.allSettled([updateStore(paths, slowMutation), updateStore(paths, slowMutation)]);
    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(LockHeldError);

    const reloaded = await loadStore(paths);
    expect(currentPlanRevision(reloaded, OCTOBER)?.revision).toBe(1);
    expect(await listDir()).toEqual(["store.json", "store.json.bak"]);
  });

  it("releases the lock after a successful save", async () => {
    await initStore(paths, NOW);
    await updateStore(paths, savePrdPlan);
    await updateStore(paths, (store) => savePrdPlan(store, 60000));
    expect(await listDir()).toEqual(["store.json", "store.json.bak"]);
  });
});

describe("imports", () => {
  const fixtures = fileURLToPath(new URL("../../../../fixtures/synthetic-financial-data/csv/", import.meta.url));
  const mapping: ScriptedAnswer[] = [null, "Date", "YYYY-MM-DD", "Description", "signed", "Amount", "negative", "", "", ""];

  function importContext(answers: readonly ScriptedAnswer[]): CommandContext {
    return {
      paths,
      out: () => {},
      err: () => {},
      now: () => new Date(NOW),
      interactive: true,
      prompter: scriptedPrompter(answers),
    };
  }

  /** A store with one earlier save, so both store.json and store.json.bak exist. */
  async function storeWithBackup(): Promise<{ store: Buffer; backup: Buffer; files: string[] }> {
    await initStore(paths, NOW);
    await updateStore(paths, savePrdPlan);
    return { store: await fs.readFile(paths.store), backup: await fs.readFile(paths.backup), files: await listDir() };
  }

  it("leaves the store and backup byte-identical when the file is invalid", async () => {
    const before = await storeWithBackup();
    await expect(runImport(importContext(mapping), `${fixtures}invalid-rows.csv`, { account: "current" })).rejects.toBeInstanceOf(CliError);
    expect(await fs.readFile(paths.store)).toEqual(before.store);
    expect(await fs.readFile(paths.backup)).toEqual(before.backup);
    expect(await listDir()).toEqual(before.files);
  });

  it("leaves the store and backup byte-identical when the preview is cancelled", async () => {
    const before = await storeWithBackup();
    await runImport(importContext([...mapping, "unknown", false]), `${fixtures}overlap-a.csv`, { account: "current" });
    expect(await fs.readFile(paths.store)).toEqual(before.store);
    expect(await fs.readFile(paths.backup)).toEqual(before.backup);
    expect(await listDir()).toEqual(before.files);
  });

  it("keeps imported entries traceable after the source CSV is deleted", async () => {
    await initStore(paths, NOW);
    const copy = path.join(root, "statement.csv");
    await fs.copyFile(`${fixtures}current-account-signed.csv`, copy);
    await runImport(importContext([...mapping, "unknown", true]), copy, { account: "current" });
    await fs.rm(copy);

    const store = await loadStore(paths);
    const tesco = store.entries.find((entry) => entry.source.description === "Tesco Stores, Leeds");
    expect(tesco).toMatchObject({ review_state: "unreviewed", source: { posted_date: "2026-10-02", amount: 5000, source_movement: "outflow" } });
    const source = store.source_records.find((record) => record.entry_id === tesco?.id);
    expect(source).toMatchObject({ row: 2, line: 3, raw: { Date: "2026-10-02", Description: "Tesco Stores, Leeds", Amount: "-50.00", Balance: "1550.00" } });
    const record = store.imports.find((candidate) => candidate.id === source?.import_id);
    expect(record).toMatchObject({ file_name: "statement.csv", row_count: 5 });
    expect(record?.file_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(store.mappings.find((candidate) => candidate.id === record?.mapping_id)).toMatchObject({ date_format: "YYYY-MM-DD", amount: { money_out_sign: "negative" } });
  });
});

describe("weekly reviews", () => {
  const fixtures = fileURLToPath(new URL("../../../../fixtures/synthetic-financial-data/csv/", import.meta.url));
  const mapping: ScriptedAnswer[] = [null, "Date", "YYYY-MM-DD", "Description", "signed", "Amount", "negative", "", "", ""];
  const WEEK = "2026-10-19";

  /** Each call is a separate process run: a fresh context that reads the store from disk. */
  function run(answers: readonly ScriptedAnswer[], interactive = true): { context: CommandContext; out: string[] } {
    const out: string[] = [];
    return {
      out,
      context: { paths, out: (line) => out.push(line), err: (line) => out.push(line), now: () => new Date(NOW), interactive, prompter: scriptedPrompter(answers) },
    };
  }

  async function show(): Promise<string> {
    const shown = run([], false);
    await runReview(shown.context, { week: WEEK, show: true });
    return shown.out.join("\n");
  }

  beforeEach(async () => {
    await initStore(paths, NOW);
    await runImport(run([...mapping, "unknown", true]).context, `${fixtures}review-week.csv`, { account: "current" });
  });

  it("keeps a confirmed action after an interruption and resumes from disk", async () => {
    // The script ends after the confirmation, as if the terminal closed at the next menu.
    const interrupted = run(["confirm", ["tx_001", "tx_002"], true, true]);
    await expect(runReview(interrupted.context, { week: WEEK })).rejects.toThrow("scripted prompter has no answer");
    const reloaded = await loadStore(paths);
    expect(reloaded.entries.filter((entry) => entry.review_state === "reviewed").map((entry) => entry.id)).toEqual(["tx_001", "tx_002"]);
    expect(await show()).toContain("Entries: 7 · reviewed 2 · unreviewed 5 · excluded duplicates 0\n");

    const resumed = run(["confirm", ["tx_003"], true, true, "exit"]);
    await runReview(resumed.context, { week: WEEK });
    expect((await loadStore(paths)).entries.filter((entry) => entry.review_state === "reviewed")).toHaveLength(3);
  });

  it("closes with unresolved entries, then flags later imports and edits without losing notes", async () => {
    await runReview(run(["reflect", "Card payment was large", "Check the card statement", true, "close", true, "exit"]).context, { week: WEEK });
    const closed = await loadStore(paths);
    expect(closed.entries.every((entry) => entry.review_state === "unreviewed")).toBe(true);
    expect(await show()).toContain("Review: closed 2026-10-28T10:00:00.000Z");

    await runImport(run([...mapping, "unknown", true]).context, `${fixtures}savings-account.csv`, { account: "savings" });
    const afterImport = await show();
    expect(afterImport).toContain("Review: CHANGED SINCE REVIEW (closed 2026-10-28T10:00:00.000Z; added tx_010)");
    expect(afterImport).toContain("What stood out? Card payment was large");
    expect(afterImport).toContain("What will you change next week? Check the card statement");

    const books = closed.categories.find((category) => category.name === "Books")?.id as string;
    await runEdit(run(["classify", "spending", "culture", books, "unreviewed", "done"]).context, "tx_002");
    expect(await show()).toContain("Review: CHANGED SINCE REVIEW (closed 2026-10-28T10:00:00.000Z; added tx_010; changed tx_002)");

    const reopened = run(["close", true, "exit"]);
    await runReview(reopened.context, { week: WEEK });
    expect(reopened.out.join("\n")).toContain("CHANGED SINCE REVIEW");
    const reclosed = await loadStore(paths);
    expect(reclosed.reviews[0]?.closures).toHaveLength(2);
    expect(reclosed.reviews[0]?.reflection).toEqual({ stood_out: "Card payment was large", next_change: "Check the card statement" });
    expect(await show()).toContain("Review: closed 2026-10-28T10:00:00.000Z");
  });

  it("exits without closing the review", async () => {
    await runReview(run(["exit"]).context, { week: WEEK });
    expect((await loadStore(paths)).reviews).toEqual([]);
    expect(await show()).toContain("Review: not closed");
  });
});

describe("reports", () => {
  const fixtures = fileURLToPath(new URL("../../../../fixtures/synthetic-financial-data/csv/", import.meta.url));
  const mapping: ScriptedAnswer[] = [null, "Date", "YYYY-MM-DD", "Description", "signed", "Amount", "negative", "", "", ""];

  function context(answers: readonly ScriptedAnswer[], interactive: boolean): CommandContext {
    return { paths, out: () => undefined, err: () => undefined, now: () => new Date(NOW), interactive, prompter: scriptedPrompter(answers) };
  }

  it("leaves the store and backup byte-identical and takes no lock", async () => {
    await initStore(paths, NOW);
    await updateStore(paths, savePrdPlan);
    await runImport(context([...mapping, "unknown", true], true), `${fixtures}review-week.csv`, { account: "current" });
    const store = await fs.readFile(paths.store);
    const backup = await fs.readFile(paths.backup);
    const files = await listDir();

    // Without a terminal and with no scripted answers: any prompt would throw.
    await runSummary(context([], false), { month: "2026-10" });
    await runSummary(context([], false), { month: "2026-11" });
    await runSpending(context([], false), { month: "2026-10" });
    await runSpending(context([], false), { week: "2026-10-26" });
    await runSpending(context([], false), { month: "2026-10", envelope: "Needs" });
    await runSpending(context([], false), { month: "2026-10", envelope: "Unclassified", category: "Uncategorised" });
    await expect(runSpending(context([], false), { envelope: "Needs", category: "Books" })).rejects.toBeInstanceOf(CliError);

    expect(await fs.readFile(paths.store)).toEqual(store);
    expect(await fs.readFile(paths.backup)).toEqual(backup);
    expect(await listDir()).toEqual(files);
  });
});
