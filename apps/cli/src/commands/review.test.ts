import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addPlanRevision, findEntry, pence, reviseEntry, savingsGoal, validatePlan, type Entry, type Month, type Store } from "@kakeibo/domain";
import type { CommandContext } from "../context.ts";
import { CliError, NotInteractiveError, UsageError } from "../errors.ts";
import { scriptedPrompter, type Prompter, type ScriptedAnswer } from "../prompts/prompter.ts";
import { storePaths, type StorePaths } from "../storage/paths.ts";
import { initStore, loadStore, updateStore } from "../storage/store-file.ts";
import { runImport } from "./import.ts";
import { runReview } from "./review.ts";

const FIXTURES = fileURLToPath(new URL("../../../../fixtures/synthetic-financial-data/csv/", import.meta.url));
const NOW = new Date("2026-10-28T10:00:00.000Z");
const WEEK = "2026-10-19";
/** Delimiter, date column and format, description, layout, amount column, sign, then no ID, currency or reference. */
const SIGNED_MAPPING: ScriptedAnswer[] = [null, "Date", "YYYY-MM-DD", "Description", "signed", "Amount", "negative", "", "", ""];

let root: string;
let paths: StorePaths;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "kakeibo-review-"));
  paths = storePaths(root);
  await initStore(paths, NOW.toISOString());
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function makeContext(answers: readonly ScriptedAnswer[], interactive = true, wrap: (prompter: Prompter) => Prompter = (prompter) => prompter) {
  const out: string[] = [];
  const err: string[] = [];
  const prompter = scriptedPrompter(answers);
  const context: CommandContext = {
    paths,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    now: () => NOW,
    interactive,
    prompter: wrap(prompter),
  };
  return { context, out, err, prompter };
}

/** tx_001 Tesco £50, tx_002 Waterstones £20, tx_003 refund £10, tx_004 transfer £200, tx_005 card payment £120, tx_006/tx_007 identical cafe £3.20, tx_008 cinema (30 Oct), tx_009 Tesco (1 Nov). */
async function importWeek(): Promise<void> {
  await runImport(makeContext([...SIGNED_MAPPING, "unknown", true]).context, `${FIXTURES}review-week.csv`, { account: "current" });
}

/** tx_010: the savings side of the £200 transfer. */
async function importSavings(): Promise<void> {
  await runImport(makeContext([...SIGNED_MAPPING, "unknown", true]).context, `${FIXTURES}savings-account.csv`, { account: "savings" });
}

async function saveOctoberPlan(): Promise<void> {
  await updateStore(paths, (store) => {
    const validated = validatePlan({
      planning_income: pence(50000),
      fixed_commitments: pence(10000),
      plan_funded_goal_allocations: [{ goal_id: savingsGoal(store).id, amount: pence(10000) }],
      envelopes: { needs: pence(15000), wants: pence(10000), culture: pence(2500), unexpected: pence(2500) },
      intention: "Cook at home",
    });
    if (!validated.ok) throw new Error("fixture must validate");
    return { store: addPlanRevision(store, "2026-10" as Month, validated.value, NOW.toISOString()).store, result: undefined };
  });
}

async function markCandidate(id: string, of: string): Promise<void> {
  await updateStore(paths, (store) => ({
    store: { ...store, entries: store.entries.map((entry) => (entry.id === id ? { ...entry, duplicate: { status: "candidate" as const, of_entry_id: of } } : entry)) },
    result: undefined,
  }));
}

async function category(name: string): Promise<string> {
  return (await loadStore(paths)).categories.find((candidate) => candidate.name === name)?.id as string;
}

function entry(store: Store, id: string): Entry {
  return findEntry(store, id) as Entry;
}

describe("review --week validation and --show", () => {
  it("rejects a week that does not start on a Monday without changing data", async () => {
    const before = await fs.readFile(paths.store, "utf8");
    const error = await runReview(makeContext([]).context, { week: "2026-10-20", show: true }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UsageError);
    expect((error as UsageError).fullMessage).toBe("--week must be a Monday; 2026-10-20 is not. Weeks run Monday to Sunday, so use --week 2026-10-19. No data was changed.");
    await expect(runReview(makeContext([]).context, { week: "2026-10-32" })).rejects.toBeInstanceOf(UsageError);
    expect(await fs.readFile(paths.store, "utf8")).toBe(before);
  });

  it("shows the week without a terminal: totals, unresolved entries, the full scan and the month-to-date plan", async () => {
    await importWeek();
    await saveOctoberPlan();
    const { context, out } = makeContext([], false);
    await runReview(context, { week: WEEK, show: true });
    const text = out.join("\n");
    expect(text).toContain("Week 2026-10-19 to 2026-10-25\nReview: not closed");
    expect(text).toContain("Entries: 7 · reviewed 0 · unreviewed 7 · excluded duplicates 0");
    expect(text).toMatch(/Unclassified\s+£0\.00\s+£396\.40/);
    expect(text).toContain("Not spending: income £10.00 · transfers £0.00 · Savings-goal contributions £0.00 (0, counted once per transfer)");
    expect(text).toContain("Unresolved classifications: 7 (£396.40 money out, £10.00 money in)");
    expect(text).toMatch(/Sat 2026-10-24\s+tx_006\s+Corner Cafe\s+-£3\.20/);
    expect(text).toMatch(/Sun 2026-10-25\s+no imported activity/);
    expect(text).toContain("2026-10: 2026-10-01 to 2026-10-25");
    expect(text).toContain("Plan revision 1 · Intention: Cook at home");
    expect(text).toMatch(/Needs\s+£150\.00\s+£0\.00\s+£0\.00\s+£150\.00/);
    expect(text).toContain("What stood out? (not written)");
  });

  it("splits a cross-month week by month and labels the missing plan", async () => {
    await importWeek();
    await saveOctoberPlan();
    const { context, out } = makeContext([], false);
    await runReview(context, { week: "2026-10-26", show: true });
    const text = out.join("\n");
    expect(text).toContain("Week 2026-10-26 to 2026-11-01 (in progress)");
    expect(text).toContain("2026-10: 2026-10-01 to 2026-10-31 (in progress)");
    expect(text).toContain("2026-11: 2026-11-01 to 2026-11-01\n  No plan saved for 2026-11. Run `kakeibo plan --month 2026-11` to create one.");
  });

  it("states that an empty week has no imported activity", async () => {
    const { context, out } = makeContext([], false);
    await runReview(context, { week: "2026-10-05", show: true });
    expect(out.join("\n")).toContain("No imported activity in this week.");
  });

  it("needs a terminal for the interactive review", async () => {
    const error = await runReview(makeContext([], false).context, { week: WEEK }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NotInteractiveError);
    expect((error as CliError).message).toContain("kakeibo review --week 2026-10-19 --show");
  });

  it("defaults to the current local week", async () => {
    const { context, out } = makeContext([], false);
    await runReview(context, { show: true });
    expect(out[0]).toMatch(/^Week 2026-10-26 to 2026-11-01/);
  });
});

describe("review (interactive)", () => {
  it("classifies a purchase and a refund, then confirms only after explicit acceptance of Unclassified entries", async () => {
    await importWeek();
    const groceries = await category("Groceries");
    const { context, out, err } = makeContext([
      "classify", "tx_001", "spending", "needs", groceries, "unreviewed",
      "classify", "tx_003", "refund", "needs", groceries, "unreviewed",
      "confirm", ["tx_001", "tx_002", "tx_003"], false, true,
      "exit",
    ]);
    await runReview(context, { week: WEEK });
    expect(err).toEqual([]);
    const text = out.join("\n");
    expect(text).toContain("tx_003 2026-10-21 Tesco refund +£10.00 (unreviewed)\n    Income, Unclassified / Uncategorised → Refund, Needs / Groceries");
    expect(text).toContain("Selected 3 entries · £70.00 money out, £10.00 money in");
    expect(text).toContain("Still selected: 2 entries · £50.00 money out, £10.00 money in");
    expect(text).toContain("Saved: 2 entries marked reviewed.");
    expect(text).toContain("Exited. The review is not closed; run the same command to resume.");

    const store = await loadStore(paths);
    expect(entry(store, "tx_001")).toMatchObject({ purpose: "spending", treatment: "needs", review_state: "reviewed" });
    expect(entry(store, "tx_003")).toMatchObject({ movement: "inflow", purpose: "refund", treatment: "needs", review_state: "reviewed" });
    expect(entry(store, "tx_002")).toMatchObject({ treatment: "unclassified", review_state: "unreviewed" });
    expect(store.history.map((record) => record.kind)).toEqual(["entry_classified", "entry_classified", "entry_confirmed", "entry_confirmed"]);
    expect(store.reviews).toEqual([]);

    const shown = makeContext([], false);
    await runReview(shown.context, { week: WEEK, show: true });
    expect(shown.out.join("\n")).toMatch(/Needs\s+£40\.00\s+£0\.00/);
  });

  it("asks for fresh confirmation when a reviewed entry's meaning changes", async () => {
    await importWeek();
    const groceries = await category("Groceries");
    const eatingOut = await category("Eating out");
    await runReview(makeContext(["classify", "tx_001", "spending", "needs", groceries, "reviewed", "exit"]).context, { week: WEEK });
    expect(entry(await loadStore(paths), "tx_001")).toMatchObject({ treatment: "needs", review_state: "reviewed" });

    const { context, prompter } = makeContext(["classify", "tx_001", "spending", "wants", eatingOut, "unreviewed", "exit"]);
    await runReview(context, { week: WEEK });
    expect(prompter.asked).toContain("Save this change?");
    expect(entry(await loadStore(paths), "tx_001")).toMatchObject({ treatment: "wants", review_state: "unreviewed" });
  });

  it("resolves a card settlement as a transfer and links both sides of a savings transfer as one contribution", async () => {
    await importWeek();
    await importSavings();
    const cardPayment = await category("Credit-card payment");
    const savings = await category("Savings");
    const { context, out, err } = makeContext([
      "classify", "tx_005", "transfer", cardPayment, "unreviewed",
      "classify", "tx_004", "goal_contribution", savings, "tx_010", "reviewed",
      "exit",
    ]);
    await runReview(context, { week: WEEK });
    expect(err).toEqual([]);
    expect(out.join("\n")).toContain("Linked to the Savings goal as one contribution of £200.00.");
    const store = await loadStore(paths);
    expect(entry(store, "tx_005")).toMatchObject({ movement: "transfer", purpose: "transfer", treatment: "outside_plan" });
    expect(store.goal_contribution_links.map((link) => link.entry_ids)).toEqual([["tx_004", "tx_010"]]);
    expect(entry(store, "tx_010")).toMatchObject({ purpose: "goal_contribution", treatment: "goal", review_state: "reviewed" });

    const shown = makeContext([], false);
    await runReview(shown.context, { week: WEEK, show: true });
    const text = shown.out.join("\n");
    expect(text).toContain("Not spending: income £10.00 · transfers £120.00 · Savings-goal contributions £200.00 (1, counted once per transfer)");
    expect(text).toMatch(/Unclassified\s+£0\.00\s+£76\.40/);
  });

  it("excludes a duplicate in bulk with retained references, blocks its confirmation while unresolved and restores it", async () => {
    await importWeek();
    await markCandidate("tx_007", "tx_006");
    const { context, out, err } = makeContext([
      "confirm", ["tx_006"], true, true,
      "duplicates", ["tx_007"], "exclude", [], true,
      "restore", ["tx_007"], true,
      "exit",
    ]);
    await runReview(context, { week: WEEK });
    expect(err).toEqual([]);
    const text = out.join("\n");
    expect(text).toContain("Not offered: tx_007 is a duplicate candidate. Resolve them first.");
    expect(text).toContain("Exclude as duplicates (contribute zero; marked reviewed): 1 entry · £3.20 money out");
    expect(text).toMatch(/tx_007\s+2026-10-24\s+Corner Cafe\s+-£3\.20\s+tx_006 2026-10-24 Corner Cafe -£3\.20/);
    expect(text).toContain("Saved 1 duplicate decision.");
    expect(text).toContain("Saved: 1 entry restored as unreviewed duplicate candidates.");
    const store = await loadStore(paths);
    expect(entry(store, "tx_007")).toMatchObject({ duplicate: { status: "candidate", of_entry_id: "tx_006" }, review_state: "unreviewed" });
    expect(store.history.map((record) => record.kind)).toEqual(["entry_confirmed", "duplicate_excluded", "duplicate_restored"]);
  });

  it("applies a bulk keep-both decision with a per-row override", async () => {
    await importWeek();
    await markCandidate("tx_007", "tx_006");
    await markCandidate("tx_009", "tx_001");
    await runReview(makeContext(["duplicates", ["tx_007"], "keep_both", [], true, "exit"]).context, { week: WEEK });
    const store = await loadStore(paths);
    expect(entry(store, "tx_007").duplicate).toEqual({ status: "kept", of_entry_id: "tx_006" });
    expect(entry(store, "tx_009").duplicate?.status).toBe("candidate");

    await markCandidate("tx_002", "tx_001");
    await runReview(makeContext(["duplicates", ["tx_002"], "keep_both", ["tx_002"], true, "exit"]).context, { week: WEEK });
    expect(entry(await loadStore(paths), "tx_002")).toMatchObject({ duplicate: { status: "excluded", of_entry_id: "tx_001" }, review_state: "reviewed" });
  });

  it("adds a category within a treatment and writes the reflection without closing", async () => {
    await importWeek();
    const { context, out } = makeContext([
      "category", "culture", "Museums", true,
      "reflect", "Fewer takeaways", "Plan two meals", true,
      "exit",
    ]);
    await runReview(context, { week: WEEK });
    expect(out.join("\n")).toContain("Saved category Culture / Museums.");
    const store = await loadStore(paths);
    expect(store.categories.at(-1)).toMatchObject({ treatment: "culture", name: "Museums" });
    expect(store.reviews[0]).toMatchObject({ week_start: WEEK, reflection: { stood_out: "Fewer takeaways", next_change: "Plan two meals" }, closures: [] });
  });

  it("refuses to save when the entry changed after the preview", async () => {
    await importWeek();
    const groceries = await category("Groceries");
    const { context } = makeContext(["classify", "tx_001", "spending", "needs", groceries, "unreviewed"], true, (prompter) => ({
      ...prompter,
      async select(message, choices, defaultValue) {
        if (message === "Save this change?") {
          await updateStore(paths, (store) => ({ store: reviseEntry(store, "tx_001", (current) => current, { kind: "entry_classified", now: NOW.toISOString() }).store, result: undefined }));
        }
        return prompter.select(message, choices, defaultValue);
      },
    }));
    const error = await runReview(context, { week: WEEK }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).fullMessage).toContain("tx_001 changed while you were deciding. Nothing was saved from this action");
    expect(entry(await loadStore(paths), "tx_001")).toMatchObject({ treatment: "unclassified", revision: 2 });
  });
});
