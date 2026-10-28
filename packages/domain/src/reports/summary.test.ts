import { describe, expect, it } from "vitest";
import { findCategory } from "../classification/categories.ts";
import { TREATMENTS, type Purpose, type Treatment } from "../classification/vocabulary.ts";
import { createImportedEntry } from "../entries/entries.ts";
import { pence } from "../money/pence.ts";
import type { IsoDate } from "../periods/periods.ts";
import { createEmptyStore, savingsGoal } from "../store/create.ts";
import type { DuplicateState, Entry, Store } from "../store/schema.ts";
import { categorySpendingTotals, combineSplits, splitTotal } from "../review/totals.ts";
import { periodSummary, reviewedRemaining, spendingEntries } from "./summary.ts";

const NOW = "2026-10-28T10:00:00.000Z";
const OCTOBER = ["2026-10-01", "2026-10-31"] as [IsoDate, IsoDate];
const NOVEMBER = ["2026-11-01", "2026-11-30"] as [IsoDate, IsoDate];

type Spec = {
  readonly date: string;
  readonly pence: number;
  readonly purpose: Purpose;
  readonly treatment: Treatment;
  readonly category: string;
  readonly reviewed?: boolean;
  readonly account?: string;
  readonly direction?: "inflow" | "outflow";
  readonly duplicate?: DuplicateState;
};

const MOVEMENT = { income: "inflow", refund: "inflow", spending: "outflow", transfer: "transfer", goal_contribution: "transfer", adjustment: "adjustment" } as const;

/** Entries classified directly, as review would leave them. tx_001 is the first spec. */
function storeWith(specs: readonly Spec[]): Store {
  let store: Store = {
    ...createEmptyStore(NOW),
    accounts: [
      { id: "acct_001", name: "current", created_at: NOW },
      { id: "acct_002", name: "savings", created_at: NOW },
    ],
  };
  for (const spec of specs) {
    const direction = spec.direction ?? (spec.purpose === "refund" || spec.purpose === "income" ? "inflow" : "outflow");
    const created = createImportedEntry(
      store,
      spec.account ?? "acct_001",
      { posted_date: spec.date as IsoDate, description: spec.category, currency: "GBP", source_movement: direction, amount: pence(spec.pence) },
      NOW,
    );
    const entry: Entry = {
      ...created.entry,
      movement: MOVEMENT[spec.purpose],
      purpose: spec.purpose,
      treatment: spec.treatment,
      category_id: findCategory(created.store, spec.treatment, spec.category)?.id as string,
      review_state: spec.reviewed === false ? "unreviewed" : "reviewed",
      ...(spec.duplicate === undefined ? {} : { duplicate: spec.duplicate }),
    };
    store = { ...created.store, entries: created.store.entries.map((candidate) => (candidate.id === entry.id ? entry : candidate)) };
  }
  return store;
}

/** The PRD §7 numeric fixture: £50 Needs/Groceries, £20 Culture/Books and a £200 transfer. */
const PURCHASES: Spec[] = [
  { date: "2026-10-05", pence: 5000, purpose: "spending", treatment: "needs", category: "Groceries" },
  { date: "2026-10-06", pence: 2000, purpose: "spending", treatment: "culture", category: "Books" },
  { date: "2026-10-08", pence: 20000, purpose: "transfer", treatment: "outside_plan", category: "Credit-card payment" },
];
const REFUND: Spec = { date: "2026-10-09", pence: 1000, purpose: "refund", treatment: "needs", category: "Groceries" };

describe("period summary", () => {
  it("reproduces the PRD fixture: refunds reduce Needs, transfers are not spending and refunds are not income", () => {
    const summary = periodSummary(storeWith([...PURCHASES, REFUND]), ...OCTOBER);
    expect(summary.spending.needs.reviewed).toEqual({ gross: 5000, refunds: 1000, net: 4000, count: 2 });
    expect(summary.spending.culture.reviewed.net).toBe(2000);
    expect(summary.flexible.reviewed).toEqual({ gross: 7000, refunds: 1000, net: 6000, count: 3 });
    expect(reviewedRemaining(pence(15000), summary.spending.needs)).toBe(11000);
    expect(summary.spending.outside_plan.reviewed.count).toBe(0);
    expect(splitTotal(summary.overall).net).toBe(6000);
    expect(summary.transfers).toEqual({ amount: 20000, count: 1 });
    expect(summary.income).toEqual({ reviewed: 0, unreviewed: 0, count: 0 });
  });

  it("keeps a refund in its posted month and never rewrites the earlier month", () => {
    const store = storeWith([...PURCHASES, { ...REFUND, date: "2026-11-02" }]);
    const october = periodSummary(store, ...OCTOBER);
    const november = periodSummary(store, ...NOVEMBER);
    expect(october.spending.needs.reviewed).toEqual({ gross: 5000, refunds: 0, net: 5000, count: 1 });
    expect(november.spending.needs.reviewed).toEqual({ gross: 0, refunds: 1000, net: -1000, count: 1 });
    expect(reviewedRemaining(pence(15000), november.spending.needs)).toBe(16000);
    expect(october.income.count + november.income.count).toBe(0);
  });

  it("handles partial refunds and refunds without an original purchase", () => {
    const store = storeWith([
      { date: "2026-10-05", pence: 8000, purpose: "spending", treatment: "wants", category: "Shopping" },
      { date: "2026-10-12", pence: 2550, purpose: "refund", treatment: "wants", category: "Shopping" },
      { date: "2026-10-13", pence: 1200, purpose: "refund", treatment: "wants", category: "Eating out" },
    ]);
    const summary = periodSummary(store, ...OCTOBER);
    expect(summary.spending.wants.reviewed).toEqual({ gross: 8000, refunds: 3750, net: 4250, count: 3 });
    const categories = categorySpendingTotals(summary.entries, "wants").map((category) => [category.category_id, category.split.reviewed.net]);
    expect(categories).toEqual([
      [findCategory(store, "wants", "Shopping")?.id, 5450],
      [findCategory(store, "wants", "Eating out")?.id, -1200],
    ]);
  });

  it("keeps an Unclassified, unreviewed refund only in the unreviewed Unclassified figures", () => {
    const summary = periodSummary(storeWith([...PURCHASES, { ...REFUND, treatment: "unclassified", category: "Uncategorised", reviewed: false }]), ...OCTOBER);
    expect(summary.spending.unclassified.reviewed.count).toBe(0);
    expect(summary.spending.unclassified.unreviewed).toEqual({ gross: 0, refunds: 1000, net: -1000, count: 1 });
    expect(summary.spending.needs.reviewed.net).toBe(5000);
    expect(summary.unreviewed_count).toBe(1);
    expect(summary.unclassified_count).toBe(1);
    expect(summary.income.count).toBe(0);
  });

  it("counts a refund once in income minus net spending", () => {
    const summary = periodSummary(storeWith([...PURCHASES, REFUND, { date: "2026-10-01", pence: 50000, purpose: "income", treatment: "outside_plan", category: "Credit-card payment" }]), ...OCTOBER);
    expect(summary.income).toEqual({ reviewed: 50000, unreviewed: 0, count: 1 });
    // £500 income − (£70 gross − £10 refunds) = £440; adding the refund again would give £450.
    expect(summary.income_minus_net_spending).toBe(44000);
  });

  it("counts a Savings-goal contribution once across both account sides and keeps it out of income and spending", () => {
    let store = storeWith([
      ...PURCHASES,
      { date: "2026-10-22", pence: 20000, purpose: "goal_contribution", treatment: "goal", category: "Savings" },
      { date: "2026-10-22", pence: 20000, purpose: "goal_contribution", treatment: "goal", category: "Savings", account: "acct_002", direction: "inflow" },
    ]);
    const allocationOnly = periodSummary(store, ...OCTOBER);
    expect(allocationOnly.contributions).toEqual([]);
    store = { ...store, goal_contribution_links: [{ id: "link_001", goal_id: savingsGoal(store).id, entry_ids: ["tx_004", "tx_005"], linked_at: NOW }] };
    const summary = periodSummary(store, ...OCTOBER);
    expect(summary.contributions.map((contribution) => [contribution.amount, contribution.reviewed])).toEqual([[20000, true]]);
    expect(splitTotal(summary.overall).net).toBe(7000);
    expect(summary.income.count).toBe(0);
    expect(summary.spending.goal.reviewed.count).toBe(0);
  });

  it("counts excluded duplicates as zero and keeps candidates in the unreviewed figures", () => {
    const summary = periodSummary(
      storeWith([
        ...PURCHASES,
        { ...PURCHASES[0]!, reviewed: true, duplicate: { status: "excluded", of_entry_id: "tx_001" } },
        { ...PURCHASES[0]!, reviewed: false, duplicate: { status: "candidate", of_entry_id: "tx_001" } },
      ]),
      ...OCTOBER,
    );
    expect(summary.spending.needs.reviewed.net).toBe(5000);
    expect(summary.spending.needs.unreviewed.net).toBe(5000);
    expect(summary.excluded_duplicates.map((entry) => entry.id)).toEqual(["tx_004"]);
    expect(summary.duplicate_candidate_count).toBe(1);
    expect(summary.unreviewed_count).toBe(1);
    expect(spendingEntries(summary.entries, "needs").map((entry) => entry.id)).toEqual(["tx_001", "tx_005"]);
  });

  it("reconciles entries to categories, categories to treatments and treatments to the overall total", () => {
    const store = storeWith([
      ...PURCHASES,
      REFUND,
      { date: "2026-10-10", pence: 1234, purpose: "spending", treatment: "needs", category: "Transport", reviewed: false },
      { date: "2026-10-11", pence: 99900, purpose: "spending", treatment: "fixed", category: "Housing" },
      { date: "2026-10-12", pence: 300, purpose: "spending", treatment: "unclassified", category: "Uncategorised", reviewed: false },
    ]);
    const summary = periodSummary(store, ...OCTOBER);
    for (const treatment of TREATMENTS) {
      const categories = categorySpendingTotals(summary.entries, treatment);
      expect(combineSplits(categories.map((category) => category.split))).toEqual(summary.spending[treatment]);
      for (const category of categories) {
        const net = spendingEntries(summary.entries, treatment, category.category_id).reduce(
          (total, entry) => total + (entry.purpose === "refund" ? -entry.source.amount : entry.source.amount),
          0,
        );
        expect(splitTotal(category.split).net).toBe(net);
      }
    }
    expect(combineSplits(TREATMENTS.map((treatment) => summary.spending[treatment]))).toEqual(summary.overall);
    expect(splitTotal(summary.overall).net).toBe(5000 + 2000 - 1000 + 1234 + 99900 + 300);
  });
});
