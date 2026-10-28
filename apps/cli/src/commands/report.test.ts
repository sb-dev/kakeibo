import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addPlanRevision,
  applyDuplicateDecisions,
  applyEntryCorrection,
  createImportedEntry,
  findCategory,
  pence,
  savingsGoal,
  validatePlan,
  type IsoDate,
  type Month,
  type Purpose,
  type Store,
  type Treatment,
} from "@kakeibo/domain";
import type { CommandContext } from "../context.ts";
import { UsageError } from "../errors.ts";
import { scriptedPrompter, type ScriptedAnswer } from "../prompts/prompter.ts";
import { storePaths, type StorePaths } from "../storage/paths.ts";
import { initStore, updateStore } from "../storage/store-file.ts";
import { runImport } from "./import.ts";
import { runSpending, type SpendingOptions } from "./spending.ts";
import { runSummary } from "./summary.ts";

const FIXTURES = fileURLToPath(new URL("../../../../fixtures/synthetic-financial-data/csv/", import.meta.url));
const NOW = new Date("2026-10-28T10:00:00.000Z");
const SIGNED_MAPPING: ScriptedAnswer[] = [null, "Date", "YYYY-MM-DD", "Description", "signed", "Amount", "negative", "", "", ""];

let root: string;
let paths: StorePaths;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "kakeibo-report-"));
  paths = storePaths(root);
  await initStore(paths, NOW.toISOString());
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

/** Reports never prompt: the scripted prompter has no answers and the context is not interactive. */
function reportContext(now: Date = NOW) {
  const out: string[] = [];
  const context: CommandContext = {
    paths,
    out: (line) => out.push(line),
    err: () => undefined,
    now: () => now,
    interactive: false,
    prompter: scriptedPrompter([]),
  };
  return { context, text: () => out.join("\n") };
}

async function importFile(file: string, account: string): Promise<void> {
  const prompter = scriptedPrompter([...SIGNED_MAPPING, "unknown", true]);
  const context: CommandContext = { paths, out: () => undefined, err: () => undefined, now: () => NOW, interactive: true, prompter };
  await runImport(context, `${FIXTURES}${file}`, { account });
}

async function summary(month?: string, now?: Date): Promise<string> {
  const { context, text } = reportContext(now);
  await runSummary(context, month === undefined ? {} : { month });
  return text();
}

async function spending(options: SpendingOptions, now?: Date): Promise<string> {
  const { context, text } = reportContext(now);
  await runSpending(context, options);
  return text();
}

function classification(store: Store, purpose: Purpose, treatment: Treatment, category: string) {
  const movement = purpose === "spending" ? "outflow" : purpose === "refund" || purpose === "income" ? "inflow" : "transfer";
  return { movement, purpose, treatment, category_id: findCategory(store, treatment, category)?.id as string } as const;
}

async function classify(id: string, purpose: Purpose, treatment: Treatment, category: string, review: "reviewed" | "unreviewed" = "reviewed", link?: string[]): Promise<void> {
  await updateStore(paths, (store) => {
    const result = applyEntryCorrection(
      store,
      {
        entries: (link ?? [id]).map((entryId) => ({ id: entryId, classification: classification(store, purpose, treatment, category) })),
        review,
        ...(link === undefined ? {} : { link }),
      },
      NOW.toISOString(),
    );
    if (!result.ok) throw new Error(result.error.join(" "));
    return { store: result.value.store, result: undefined };
  });
}

async function saveOctoberPlan(month = "2026-10"): Promise<void> {
  await updateStore(paths, (store) => {
    const validated = validatePlan({
      planning_income: pence(50000),
      fixed_commitments: pence(10000),
      plan_funded_goal_allocations: [{ goal_id: savingsGoal(store).id, amount: pence(10000) }],
      envelopes: { needs: pence(15000), wants: pence(10000), culture: pence(2500), unexpected: pence(2500) },
      intention: "Cook at home",
    });
    if (!validated.ok) throw new Error("fixture must validate");
    return { store: addPlanRevision(store, month as Month, validated.value, NOW.toISOString()).store, result: undefined };
  });
}

/**
 * The PRD §7 fixture from `review-week.csv`: tx_001 Tesco £50 and tx_003 refund £10 (Needs/Groceries),
 * tx_002 Waterstones £20 (Culture/Books), tx_005 card payment £120 (transfer), tx_007 an excluded
 * duplicate of tx_006, all reviewed. tx_006, tx_008 and tx_009 stay unresolved.
 */
async function prdFixture(): Promise<void> {
  await importFile("review-week.csv", "current");
  await saveOctoberPlan();
  await classify("tx_001", "spending", "needs", "Groceries");
  await classify("tx_002", "spending", "culture", "Books");
  await classify("tx_003", "refund", "needs", "Groceries");
  await classify("tx_005", "transfer", "outside_plan", "Credit-card payment");
  await updateStore(paths, (store) => {
    const marked = { ...store, entries: store.entries.map((entry) => (entry.id === "tx_007" ? { ...entry, duplicate: { status: "candidate" as const, of_entry_id: "tx_006" } } : entry)) };
    const result = applyDuplicateDecisions(marked, [{ entry_id: "tx_007", action: "exclude" }], NOW.toISOString());
    if (!result.ok) throw new Error(result.error.join(" "));
    return { store: result.value.store, result: undefined };
  });
}

/** Adds an imported entry to the `current` account on a given date, unclassified and unreviewed. */
async function addEntry(date: string, amount: number, description: string): Promise<void> {
  await updateStore(paths, (store) => ({
    store: createImportedEntry(store, "acct_001", { posted_date: date as IsoDate, description, currency: "GBP", source_movement: "outflow", amount: pence(amount) }, NOW.toISOString()).store,
    result: undefined,
  }));
}

describe("summary", () => {
  it("reproduces the PRD fixture with the plan, observed totals, envelopes, Fixed and categories", async () => {
    await prdFixture();
    const text = await summary("2026-10");
    expect(text).toContain("Summary for 2026-10 (2026-10-01 to 2026-10-31) (in progress)");
    expect(text).toContain("They are not a bank balance");
    expect(text).toMatch(/Planned income\s+£500\.00/);
    expect(text).toMatch(/Savings allocation\s+£100\.00/);
    expect(text).toContain("Intention: Cook at home");
    // Reviewed: £70 gross, £10 refunds, £60 net. Unreviewed: tx_006 £3.20 and tx_008 £12.00, and the
    // unresolved £200 transfer is still spending until it is classified.
    expect(text).toMatch(/Income\s+£0\.00\s+£0\.00\s+£0\.00/);
    expect(text).toMatch(/Gross spending\s+£70\.00\s+£215\.20\s+£285\.20/);
    expect(text).toMatch(/Refunds\s+£10\.00\s+£0\.00\s+£10\.00/);
    expect(text).toMatch(/Net spending\s+£60\.00\s+£215\.20\s+£275\.20/);
    expect(text).toContain("Income minus net spending: -£275.20 (£0.00 − £275.20)");
    expect(text).toContain("Not spending: transfers £120.00 (1) · excluded duplicates £3.20 (1)");
    expect(text).toContain("Savings goal: planned allocation £100.00 · contributions, counted once per transfer: reviewed £0.00 (0) · unreviewed £0.00 (0)");
    expect(text).toMatch(/Needs\s+£150\.00\s+£40\.00\s+£0\.00\s+£110\.00/);
    expect(text).toMatch(/Culture\s+£25\.00\s+£20\.00\s+£0\.00\s+£5\.00/);
    expect(text).toMatch(/Flexible total\s+£300\.00\s+£60\.00\s+£0\.00\s+£240\.00/);
    expect(text).toMatch(/Fixed\s+£100\.00\s+£0\.00\s+£0\.00\s+£100\.00/);
    expect(text).toMatch(/Outside plan\s+—\s+£0\.00\s+£0\.00\s+—/);
    expect(text).toMatch(/Unclassified\s+—\s+£0\.00\s+£215\.20\s+—/);
    expect(text).toMatch(/Needs \/ Groceries\s+£50\.00\s+£10\.00\s+£40\.00\s+£40\.00\s+£0\.00\s+2/);
    expect(text).toMatch(/Unclassified \/ Uncategorised\s+£215\.20\s+£0\.00\s+£215\.20\s+£0\.00\s+£215\.20\s+3/);
    expect(text).toContain("Unresolved: 3 unreviewed · 3 Unclassified · 0 duplicate candidates");
  });

  it("keeps a linked Savings-goal contribution out of spending and counts both account sides once", async () => {
    await prdFixture();
    await importFile("savings-account.csv", "savings");
    await classify("tx_004", "goal_contribution", "goal", "Savings", "reviewed", ["tx_004", "tx_010"]);
    const text = await summary("2026-10");
    expect(text).toContain("contributions, counted once per transfer: reviewed £200.00 (1) · unreviewed £0.00 (0)");
    expect(text).toMatch(/Gross spending\s+£70\.00\s+£15\.20\s+£85\.20/);
    expect(text).toMatch(/Income\s+£0\.00\s+£0\.00\s+£0\.00/);
  });

  it("labels a missing plan and a month with no imported activity", async () => {
    await importFile("review-week.csv", "current");
    const november = await summary("2026-11");
    expect(november).toContain("Summary for 2026-11 (2026-11-01 to 2026-11-30)\n");
    expect(november).toContain("No plan saved for 2026-11. Run `kakeibo plan --month 2026-11` to create one.");
    expect(november).toMatch(/Needs\s+no plan\s+£0\.00\s+£0\.00\s+—/);
    await saveOctoberPlan("2026-09");
    const september = await summary("2026-09");
    expect(september).toContain("No imported activity in 2026-09.");
    expect(september).not.toContain("in progress");
    expect(september).toMatch(/Needs\s+£150\.00\s+£0\.00\s+£0\.00\s+£150\.00/);
    expect(september).toMatch(/Unexpected\s+£25\.00\s+£0\.00\s+£0\.00\s+£25\.00/);
    expect(september).toMatch(/Flexible total\s+£300\.00\s+£0\.00\s+£0\.00\s+£300\.00/);
    expect(september).toMatch(/Fixed\s+£100\.00\s+£0\.00\s+£0\.00\s+£100\.00/);
  });

  it("keeps a next-month refund in its posted month: earlier months unchanged, negative net spending allowed", async () => {
    await prdFixture();
    await updateStore(paths, (store) => ({
      store: createImportedEntry(store, "acct_001", { posted_date: "2026-11-03" as IsoDate, description: "Tesco refund", currency: "GBP", source_movement: "inflow", amount: pence(1000) }, NOW.toISOString()).store,
      result: undefined,
    }));
    const octoberBefore = await summary("2026-10");
    await classify("tx_010", "refund", "needs", "Groceries");
    expect(await summary("2026-10")).toBe(octoberBefore);
    const november = await summary("2026-11");
    expect(november).toMatch(/Needs \/ Groceries\s+£0\.00\s+£10\.00\s+-£10\.00\s+-£10\.00\s+£0\.00\s+1/);
    expect(november).toMatch(/Income\s+£0\.00\s+£0\.00\s+£0\.00/);
  });

  it("defaults to the current local month", async () => {
    await importFile("review-week.csv", "current");
    expect(await summary()).toContain("Summary for 2026-10 (2026-10-01 to 2026-10-31) (in progress)");
    expect(await summary(undefined, new Date(2026, 10, 1, 0, 30))).toContain("Summary for 2026-11 (2026-11-01 to 2026-11-30) (in progress)");
  });

  it("rejects an invalid month", async () => {
    await expect(summary("2026-13")).rejects.toBeInstanceOf(UsageError);
  });
});

describe("spending", () => {
  it("drills from treatments to categories to entries, and each level reconciles with the summary", async () => {
    await prdFixture();
    const treatments = await spending({ month: "2026-10" });
    expect(treatments).toMatch(/Needs\s+£50\.00\s+£10\.00\s+£40\.00\s+£40\.00\s+£0\.00\s+2/);
    expect(treatments).toMatch(/Outside plan\s+£0\.00\s+£0\.00\s+£0\.00\s+£0\.00\s+£0\.00\s+0/);
    expect(treatments).toMatch(/Total\s+£285\.20\s+£10\.00\s+£275\.20\s+£60\.00\s+£215\.20\s+6/);
    expect(treatments).toContain("Plan revision 1 · Intention: Cook at home");

    const needs = await spending({ month: "2026-10", envelope: "needs" });
    expect(needs).toContain("Needs spending for 2026-10 (2026-10-01 to 2026-10-31) (in progress)");
    expect(needs).toMatch(/Groceries\s+£50\.00\s+£10\.00\s+£40\.00\s+£40\.00\s+£0\.00\s+2/);
    expect(needs).toMatch(/Needs total\s+£50\.00\s+£10\.00\s+£40\.00\s+£40\.00\s+£0\.00\s+2/);
    expect(needs).toContain("2026-10 (2026-10-01 to 2026-10-31) (in progress): limit £150.00 · reviewed £40.00 · unreviewed £0.00 · reviewed remaining £110.00");

    const groceries = await spending({ month: "2026-10", envelope: "Needs", category: "groceries" });
    expect(groceries).toMatch(/tx_001\s+2026-10-19\s+current\s+Tesco Stores\s+Spending\s+Needs \/ Groceries\s+£50\.00\s+reviewed/);
    expect(groceries).toMatch(/tx_003\s+2026-10-21\s+current\s+Tesco refund\s+Refund\s+Needs \/ Groceries\s+-£10\.00\s+reviewed/);
    expect(groceries).toContain("Total: gross £50.00 · refunds £10.00 · net £40.00 · reviewed £40.00 · unreviewed £0.00 · entries 2");
  });

  it("keeps reviewed and unreviewed Savings-goal contributions apart, counting a linked pair once", async () => {
    await prdFixture();
    await importFile("savings-account.csv", "savings");
    // tx_004 and tx_010 are both sides of one £200 transfer; only tx_004 is reviewed.
    await classify("tx_004", "goal_contribution", "goal", "Savings", "reviewed", ["tx_004", "tx_010"]);
    await classify("tx_010", "goal_contribution", "goal", "Savings", "unreviewed");
    await addEntry("2026-10-27", 5000, "Transfer to savings");
    await classify("tx_011", "goal_contribution", "goal", "Savings", "reviewed", ["tx_011"]);
    const text = await spending({ month: "2026-10" });
    expect(text).toContain("Savings-goal contributions, counted once per transfer: reviewed £50.00 (1) · unreviewed £200.00 (1)");
    expect(await summary("2026-10")).toContain("contributions, counted once per transfer: reviewed £50.00 (1) · unreviewed £200.00 (1)");
  });

  it("lists excluded duplicates as not counted and keeps duplicate candidates in the unreviewed figures", async () => {
    await prdFixture();
    await importFile("savings-account.csv", "savings");
    await updateStore(paths, (store) => ({
      store: { ...store, entries: store.entries.map((entry) => (entry.id === "tx_008" ? { ...entry, duplicate: { status: "candidate" as const, of_entry_id: "tx_006" } } : entry)) },
      result: undefined,
    }));
    const text = await spending({ month: "2026-10", envelope: "Unclassified", category: "Uncategorised" });
    expect(text).toMatch(/tx_008\s+2026-10-30\s+current\s+Cinema City\s+Spending\s+Unclassified \/ Uncategorised\s+£12\.00\s+unreviewed\s+duplicate\? of tx_006/);
    expect(text).toContain("unreviewed £215.20 · entries 3");
    expect(text).toContain("Not counted (excluded duplicates):\n  tx_007 2026-10-24 Corner Cafe £3.20 · excluded duplicate of tx_006");
    expect(await spending({ month: "2026-10", envelope: "outside-plan" })).toContain("Outside plan has no plan limit.");
  });

  it("shows a week that spans two months against each month's plan and labels the missing plan", async () => {
    await prdFixture();
    const text = await spending({ week: "2026-10-26" });
    expect(text).toContain("Spending for week 2026-10-26 to 2026-11-01 (in progress)");
    expect(text).toMatch(/Unclassified\s+£42\.00\s+£0\.00\s+£42\.00\s+£0\.00\s+£42\.00\s+2/);
    expect(text).toContain("2026-10: 2026-10-01 to 2026-10-31 (in progress)");
    expect(text).toContain("2026-11: 2026-11-01 to 2026-11-01\n  No plan saved for 2026-11.");
    const needs = await spending({ week: "2026-10-26", envelope: "Needs" });
    expect(needs).toContain("No Needs spending or refunds in this period.");
    expect(needs).toContain("2026-10 (2026-10-01 to 2026-10-31) (in progress): limit £150.00 · reviewed £40.00");
    expect(needs).toContain("2026-11 (2026-11-01 to 2026-11-01): no plan saved.");
  });

  it("places Sunday and Monday entries in their own weeks", async () => {
    await importFile("review-week.csv", "current");
    await addEntry("2026-10-25", 700, "Sunday market");
    await addEntry("2026-10-26", 900, "Monday bakery");
    const first = await spending({ week: "2026-10-19", envelope: "Unclassified", category: "Uncategorised" });
    const second = await spending({ week: "2026-10-26", envelope: "Unclassified", category: "Uncategorised" });
    expect(first).toContain("Sunday market");
    expect(first).not.toContain("Monday bakery");
    expect(second).toContain("Monday bakery");
    expect(second).not.toContain("Sunday market");
    expect(first).toContain("Unclassified / Uncategorised spending for week 2026-10-19 to 2026-10-25\n");
  });

  it("separates months and years at 31 December and includes 29 February in a leap year", async () => {
    await importFile("review-week.csv", "current");
    await addEntry("2026-12-31", 1100, "New Year's Eve");
    await addEntry("2027-01-01", 1300, "New Year's Day");
    await addEntry("2028-02-29", 2900, "Leap day");
    const december = await spending({ month: "2026-12", envelope: "Unclassified", category: "Uncategorised" });
    expect(december).toContain("New Year's Eve");
    expect(december).not.toContain("New Year's Day");
    expect(await spending({ month: "2027-01", envelope: "Unclassified", category: "Uncategorised" })).toContain("entries 1");
    const yearWeek = await spending({ week: "2026-12-28" });
    expect(yearWeek).toContain("2026-12: 2026-12-01 to 2026-12-31");
    expect(yearWeek).toContain("2027-01: 2027-01-01 to 2027-01-03");
    expect(await summary("2028-02")).toContain("Summary for 2028-02 (2028-02-01 to 2028-02-29)");
    expect(await summary("2028-02")).toMatch(/Unclassified \/ Uncategorised\s+£29\.00/);
  });

  it("defaults to the current local month", async () => {
    await importFile("review-week.csv", "current");
    expect(await spending({})).toContain("Spending for 2026-10 (2026-10-01 to 2026-10-31) (in progress)");
  });

  it("rejects conflicting periods, a category without an envelope and unknown names", async () => {
    await prdFixture();
    const usage = async (options: SpendingOptions): Promise<string> => {
      const error = await spending(options).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(UsageError);
      return (error as UsageError).fullMessage;
    };
    expect(await usage({ month: "2026-10", week: "2026-10-19" })).toBe("Use either --month or --week, not both. No data was changed.");
    expect(await usage({ category: "Groceries" })).toBe("--category needs --envelope, for example --envelope Needs --category Groceries. No data was changed.");
    expect(await usage({ envelope: "Food" })).toBe(
      "Unknown --envelope 'Food'. Use one of: Fixed, Needs, Wants, Culture, Unexpected, Outside plan, Unclassified. No data was changed.",
    );
    expect(await usage({ envelope: "Goal" })).toContain("Goal contributions are not spending.");
    expect(await usage({ envelope: "Needs", category: "Books" })).toBe("Needs has no category 'Books'. Its categories: Groceries, Transport. No data was changed.");
    expect(await usage({ week: "2026-10-20" })).toContain("--week must be a Monday");
  });
});
