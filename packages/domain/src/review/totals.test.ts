import { describe, expect, it } from "vitest";
import { findCategory } from "../classification/categories.ts";
import type { Treatment } from "../classification/vocabulary.ts";
import { createImportedEntry } from "../entries/entries.ts";
import { pence, subPence } from "../money/pence.ts";
import type { IsoDate } from "../periods/periods.ts";
import { createEmptyStore } from "../store/create.ts";
import type { Entry, Store } from "../store/schema.ts";
import { entriesInRange, spendingTotals } from "./totals.ts";

const NOW = "2026-10-28T10:00:00.000Z";

type Spec = {
  readonly date: string;
  readonly pounds: number;
  readonly purpose: "spending" | "refund" | "transfer" | "income";
  readonly treatment: Treatment;
  readonly category: string;
  readonly reviewed?: boolean;
};

/** The PRD §7 numeric fixture, classified directly. */
function storeWith(specs: readonly Spec[]): Store {
  let store: Store = { ...createEmptyStore(NOW), accounts: [{ id: "acct_001", name: "current", created_at: NOW }] };
  for (const spec of specs) {
    const inflow = spec.purpose === "refund" || spec.purpose === "income";
    const created = createImportedEntry(
      store,
      "acct_001",
      { posted_date: spec.date as IsoDate, description: spec.category, currency: "GBP", source_movement: inflow ? "inflow" : "outflow", amount: pence(spec.pounds * 100) },
      NOW,
    );
    const entry: Entry = {
      ...created.entry,
      movement: spec.purpose === "transfer" ? "transfer" : inflow ? "inflow" : "outflow",
      purpose: spec.purpose,
      treatment: spec.treatment,
      category_id: findCategory(created.store, spec.treatment, spec.category)?.id as string,
      review_state: spec.reviewed === false ? "unreviewed" : "reviewed",
    };
    store = { ...created.store, entries: created.store.entries.map((candidate) => (candidate.id === entry.id ? entry : candidate)) };
  }
  return store;
}

const PURCHASES: Spec[] = [
  { date: "2026-10-05", pounds: 50, purpose: "spending", treatment: "needs", category: "Groceries" },
  { date: "2026-10-06", pounds: 20, purpose: "spending", treatment: "culture", category: "Books" },
  { date: "2026-10-08", pounds: 200, purpose: "transfer", treatment: "outside_plan", category: "Credit-card payment" },
];

describe("spending totals", () => {
  it("reproduces the PRD fixture: a refund reduces Needs and is never income", () => {
    const store = storeWith([...PURCHASES, { date: "2026-10-09", pounds: 10, purpose: "refund", treatment: "needs", category: "Groceries" }]);
    const totals = spendingTotals(store.entries);
    expect(totals.needs.reviewed).toEqual({ gross: 5000, refunds: 1000, net: 4000, count: 2 });
    expect(totals.culture.reviewed.net).toBe(2000);
    expect(totals.needs.reviewed.net + totals.culture.reviewed.net).toBe(6000);
    expect(totals.outside_plan.reviewed.count).toBe(0);
    expect(subPence(pence(15000), totals.needs.reviewed.net)).toBe(11000);
  });

  it("keeps a refund in its posted month, allowing negative net spending", () => {
    const store = storeWith([...PURCHASES, { date: "2026-11-02", pounds: 10, purpose: "refund", treatment: "needs", category: "Groceries" }]);
    const october = spendingTotals(entriesInRange(store, "2026-10-01" as IsoDate, "2026-10-31" as IsoDate));
    const november = spendingTotals(entriesInRange(store, "2026-11-01" as IsoDate, "2026-11-30" as IsoDate));
    expect(october.needs.reviewed.net).toBe(5000);
    expect(november.needs.reviewed).toEqual({ gross: 0, refunds: 1000, net: -1000, count: 1 });
  });

  it("puts an unreviewed refund only in the unreviewed figures", () => {
    const store = storeWith([...PURCHASES, { date: "2026-10-09", pounds: 10, purpose: "refund", treatment: "needs", category: "Groceries", reviewed: false }]);
    const totals = spendingTotals(store.entries);
    expect(totals.needs.reviewed.net).toBe(5000);
    expect(totals.needs.unreviewed).toEqual({ gross: 0, refunds: 1000, net: -1000, count: 1 });
  });
});
