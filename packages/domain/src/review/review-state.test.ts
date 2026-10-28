import { describe, expect, it } from "vitest";
import { findCategory } from "../classification/categories.ts";
import type { Classification } from "../classification/rules.ts";
import type { Treatment } from "../classification/vocabulary.ts";
import { createImportedEntry, findEntry } from "../entries/entries.ts";
import { pence } from "../money/pence.ts";
import type { IsoDate } from "../periods/periods.ts";
import { createEmptyStore } from "../store/create.ts";
import type { Entry, SourceMovement, Store } from "../store/schema.ts";
import { validateStore } from "../store/validate.ts";
import { applyEntryCorrection, confirmEntries } from "./corrections.ts";
import { applyDuplicateDecisions, restoreDuplicates } from "./duplicates.ts";
import { goalContributions, spendingTotals } from "./totals.ts";
import { closeReview, reviewStatus, saveReflection } from "./weekly.ts";

const NOW = "2026-10-28T10:00:00.000Z";
const LATER = "2026-10-29T10:00:00.000Z";
const WEEK = "2026-10-19" as IsoDate;

type Row = { readonly date: string; readonly description: string; readonly pounds: number; readonly direction: SourceMovement; readonly account?: string };

/** A store with accounts acct_001 (current) and acct_002 (savings) and one unreviewed entry per row: tx_001, tx_002, … */
function storeWith(rows: readonly Row[]): Store {
  let store: Store = {
    ...createEmptyStore(NOW),
    accounts: [
      { id: "acct_001", name: "current", created_at: NOW },
      { id: "acct_002", name: "savings", created_at: NOW },
    ],
    counters: { ...createEmptyStore(NOW).counters, acct: 2 },
  };
  for (const row of rows) {
    store = createImportedEntry(
      store,
      row.account ?? "acct_001",
      { posted_date: row.date as IsoDate, description: row.description, currency: "GBP", source_movement: row.direction, amount: pence(Math.round(row.pounds * 100)) },
      NOW,
    ).store;
  }
  return store;
}

function category(store: Store, treatment: Treatment, name: string): string {
  return findCategory(store, treatment, name)?.id as string;
}

function spending(store: Store, treatment: Treatment, name: string): Classification {
  return { movement: "outflow", purpose: "spending", treatment, category_id: category(store, treatment, name) };
}

function entry(store: Store, id: string): Entry {
  return findEntry(store, id) as Entry;
}

function value<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
}

function expectValid(store: Store): void {
  const validated = validateStore(JSON.parse(JSON.stringify(store)));
  expect(validated.ok ? [] : validated.error).toEqual([]);
}

const WEEK_ROWS: Row[] = [
  { date: "2026-10-19", description: "TESCO", pounds: 50, direction: "outflow" },
  { date: "2026-10-20", description: "WATERSTONES", pounds: 20, direction: "outflow" },
  { date: "2026-10-21", description: "TESCO REFUND", pounds: 10, direction: "inflow" },
  { date: "2026-10-22", description: "TO SAVINGS", pounds: 200, direction: "outflow" },
  { date: "2026-10-22", description: "FROM CURRENT", pounds: 200, direction: "inflow", account: "acct_002" },
];

describe("confirmation", () => {
  it("marks entries reviewed only through explicit confirmation and records each change", () => {
    const store = storeWith(WEEK_ROWS);
    expect(store.entries.every((candidate) => candidate.review_state === "unreviewed" && candidate.revision === 1)).toBe(true);
    const classified = value(applyEntryCorrection(store, { entries: [{ id: "tx_001", classification: spending(store, "needs", "Groceries") }], review: "unreviewed" }, NOW));
    expect(entry(classified.store, "tx_001")).toMatchObject({ treatment: "needs", review_state: "unreviewed", revision: 2 });

    const confirmed = value(confirmEntries(classified.store, ["tx_001"], { acceptUnclassified: false }, NOW));
    expect(entry(confirmed.store, "tx_001")).toMatchObject({ review_state: "reviewed", revision: 3 });
    expect(confirmed.store.history.map((record) => record.kind)).toEqual(["entry_classified", "entry_confirmed"]);
    expect(confirmed.store.history.at(-1)).toMatchObject({ subject_id: "tx_001", before: { review_state: "unreviewed" }, after: { review_state: "reviewed" } });
    expectValid(confirmed.store);
  });

  it("needs explicit acceptance to confirm Unclassified entries and rejects already reviewed ones", () => {
    const store = storeWith(WEEK_ROWS);
    expect(confirmEntries(store, ["tx_002"], { acceptUnclassified: false }, NOW)).toEqual({
      ok: false,
      error: ["tx_002 is Unclassified / Uncategorised; confirming it needs explicit acceptance."],
    });
    const accepted = value(confirmEntries(store, ["tx_002", "tx_003"], { acceptUnclassified: true }, NOW));
    expect(accepted.entries.map((candidate) => [candidate.id, candidate.treatment, candidate.review_state])).toEqual([
      ["tx_002", "unclassified", "reviewed"],
      ["tx_003", "unclassified", "reviewed"],
    ]);
    expect(accepted.store.history.at(-1)?.note).toBe("Bulk confirmation of 2 entries");
    expect(confirmEntries(accepted.store, ["tx_002"], { acceptUnclassified: true }, NOW)).toEqual({ ok: false, error: ["tx_002 is already reviewed."] });
  });

  it("blocks confirmation of an unresolved duplicate candidate, alone or in bulk", () => {
    const base = storeWith([...WEEK_ROWS, { date: "2026-10-19", description: "TESCO", pounds: 50, direction: "outflow" }]);
    const store: Store = { ...base, entries: base.entries.map((candidate) => (candidate.id === "tx_006" ? { ...candidate, duplicate: { status: "candidate", of_entry_id: "tx_001" } } : candidate)) };
    const result = confirmEntries(store, ["tx_001", "tx_006"], { acceptUnclassified: true }, NOW);
    expect(result).toEqual({ ok: false, error: ["tx_006 is an unresolved duplicate candidate of tx_001; keep both or exclude it first."] });
    const correction = applyEntryCorrection(store, { entries: [{ id: "tx_006", classification: spending(store, "needs", "Groceries") }], review: "reviewed" }, NOW);
    expect(correction.ok).toBe(false);
  });
});

describe("corrections", () => {
  it("keeps a reviewed entry reviewed only with fresh confirmation", () => {
    const store = value(confirmEntries(storeWith(WEEK_ROWS), ["tx_001"], { acceptUnclassified: true }, NOW)).store;
    const confirmedAgain = value(applyEntryCorrection(store, { entries: [{ id: "tx_001", classification: spending(store, "wants", "Eating out") }], review: "reviewed" }, NOW));
    expect(entry(confirmedAgain.store, "tx_001")).toMatchObject({ treatment: "wants", review_state: "reviewed" });
    const dropped = value(applyEntryCorrection(store, { entries: [{ id: "tx_001", classification: spending(store, "wants", "Eating out") }], review: "unreviewed" }, NOW));
    expect(entry(dropped.store, "tx_001")).toMatchObject({ treatment: "wants", review_state: "unreviewed" });
    expect(dropped.store.history.at(-1)).toMatchObject({ kind: "entry_classified", before: { treatment: "unclassified", review_state: "reviewed" }, after: { treatment: "wants", review_state: "unreviewed" } });
  });

  it("classifies refunds, transfers and card settlements and rejects classifications that do not fit", () => {
    const store = storeWith(WEEK_ROWS);
    const refund: Classification = { movement: "inflow", purpose: "refund", treatment: "needs", category_id: category(store, "needs", "Groceries") };
    const settlement: Classification = { movement: "transfer", purpose: "transfer", treatment: "outside_plan", category_id: category(store, "outside_plan", "Credit-card payment") };
    const corrected = value(applyEntryCorrection(store, { entries: [{ id: "tx_003", classification: refund }, { id: "tx_004", classification: settlement }], review: "unreviewed" }, NOW));
    expect(corrected.entries.map((candidate) => [candidate.id, candidate.movement, candidate.purpose, candidate.treatment])).toEqual([
      ["tx_003", "inflow", "refund", "needs"],
      ["tx_004", "transfer", "transfer", "outside_plan"],
    ]);
    expectValid(corrected.store);

    expect(applyEntryCorrection(store, { entries: [{ id: "tx_001", classification: { ...refund } }], review: "unreviewed" }, NOW)).toEqual({ ok: false, error: ["tx_001: refund does not fit money out."] });
    expect(applyEntryCorrection(store, { entries: [{ id: "tx_001", classification: { ...spending(store, "needs", "Groceries"), treatment: "wants" } }], review: "unreviewed" }, NOW)).toEqual({
      ok: false,
      error: ["tx_001: category Groceries belongs to Needs, not Wants."],
    });
    expect(applyEntryCorrection(store, { entries: [{ id: "tx_004", classification: { ...settlement, treatment: "needs", category_id: category(store, "needs", "Groceries") } }], review: "unreviewed" }, NOW)).toEqual({
      ok: false,
      error: ["tx_004: Needs does not fit purpose transfer."],
    });
  });
});

describe("Savings-goal contributions", () => {
  const goal = (store: Store): Classification => ({ movement: "transfer", purpose: "goal_contribution", treatment: "goal", category_id: category(store, "goal", "Savings") });

  it("counts one contribution when both account sides of a transfer are linked", () => {
    const store = storeWith(WEEK_ROWS);
    const linked = value(applyEntryCorrection(store, { entries: [{ id: "tx_004", classification: goal(store) }, { id: "tx_005", classification: goal(store) }], link: ["tx_004", "tx_005"], review: "reviewed" }, NOW));
    const contributions = goalContributions(linked.store, WEEK, "2026-10-25" as IsoDate);
    expect(contributions.map((contribution) => [contribution.link.entry_ids, contribution.amount, contribution.reviewed])).toEqual([[["tx_004", "tx_005"], 20000, true]]);
    expect(spendingTotals(linked.store.entries).goal).toMatchObject({ reviewed: { net: 0, count: 0 } });
    expectValid(linked.store);
  });

  it("joins the other side to an existing one-sided link instead of counting it twice", () => {
    const store = storeWith(WEEK_ROWS);
    const first = value(applyEntryCorrection(store, { entries: [{ id: "tx_004", classification: goal(store) }], link: ["tx_004"], review: "unreviewed" }, NOW)).store;
    const joined = value(applyEntryCorrection(first, { entries: [{ id: "tx_005", classification: goal(first) }], link: ["tx_005", "tx_004"], review: "unreviewed" }, NOW)).store;
    expect(joined.goal_contribution_links.map((link) => link.entry_ids)).toEqual([["tx_004", "tx_005"]]);
    expect(goalContributions(joined, WEEK, "2026-10-25" as IsoDate)).toHaveLength(1);
  });

  it("flags a closed week when a later correction joins its entry to a link from another week", () => {
    // The savings side posts on Monday 26 October; the current-account side on Sunday 25 October.
    const rows: Row[] = [
      { date: "2026-10-25", description: "TO SAVINGS", pounds: 200, direction: "outflow" },
      { date: "2026-10-26", description: "FROM CURRENT", pounds: 200, direction: "inflow", account: "acct_002" },
    ];
    const nextWeek = "2026-10-26" as IsoDate;
    let store = storeWith(rows);
    store = value(applyEntryCorrection(store, { entries: [{ id: "tx_002", classification: goal(store) }], link: ["tx_002"], review: "reviewed" }, NOW)).store;
    store = closeReview(store, nextWeek, NOW).store;
    expect(goalContributions(store, nextWeek, "2026-11-01" as IsoDate).map((contribution) => contribution.amount)).toEqual([20000]);

    store = value(applyEntryCorrection(store, { entries: [{ id: "tx_001", classification: goal(store) }, { id: "tx_002", classification: goal(store) }], link: ["tx_001", "tx_002"], review: "reviewed" }, LATER)).store;
    expect(goalContributions(store, nextWeek, "2026-11-01" as IsoDate)).toEqual([]);
    expect(reviewStatus(store, nextWeek)).toMatchObject({ state: "changed_since_review", added: [], removed: [], revised: ["tx_002"] });
    expect(store.reviews[0]?.closures).toHaveLength(1);
    expectValid(store);
  });

  it("rejects mismatched sides and goal contributions without a link", () => {
    const store = storeWith(WEEK_ROWS);
    const mismatched = applyEntryCorrection(store, { entries: [{ id: "tx_001", classification: goal(store) }, { id: "tx_004", classification: goal(store) }], link: ["tx_001", "tx_004"], review: "unreviewed" }, NOW);
    expect(mismatched.ok ? [] : [...mismatched.error].sort()).toEqual([
      "link_001 links entries with different amounts.",
      "link_001 links two entries in the same account.",
      "link_001 links two entries in the same direction.",
    ]);
    expect(mismatched.ok).toBe(false);
    expect(applyEntryCorrection(store, { entries: [{ id: "tx_004", classification: goal(store) }], review: "unreviewed" }, NOW)).toEqual({ ok: false, error: ["tx_004 is a goal contribution without a Savings-goal link."] });
  });

  it("removes a link when its entries change type", () => {
    const store = storeWith(WEEK_ROWS);
    const linked = value(applyEntryCorrection(store, { entries: [{ id: "tx_004", classification: goal(store) }, { id: "tx_005", classification: goal(store) }], link: ["tx_004", "tx_005"], review: "unreviewed" }, NOW)).store;
    const transfer: Classification = { movement: "transfer", purpose: "transfer", treatment: "outside_plan", category_id: category(store, "outside_plan", "Credit-card payment") };
    const unlinked = value(applyEntryCorrection(linked, { entries: [{ id: "tx_004", classification: transfer }, { id: "tx_005", classification: transfer }], unlink: "link_001", review: "unreviewed" }, NOW)).store;
    expect(unlinked.goal_contribution_links).toEqual([]);
    expect(unlinked.history.filter((record) => record.subject_type === "goal_link").map((record) => record.kind)).toEqual(["goal_link_added", "goal_link_removed"]);
    expectValid(unlinked);
  });
});

describe("duplicate decisions", () => {
  function withCandidates(): Store {
    const base = storeWith([
      ...WEEK_ROWS,
      { date: "2026-10-19", description: "TESCO", pounds: 50, direction: "outflow" },
      { date: "2026-10-20", description: "WATERSTONES", pounds: 20, direction: "outflow" },
    ]);
    const candidates: Record<string, string> = { tx_006: "tx_001", tx_007: "tx_002" };
    return {
      ...base,
      entries: base.entries.map((candidate) => {
        const of = candidates[candidate.id];
        return of === undefined ? candidate : { ...candidate, duplicate: { status: "candidate", of_entry_id: of } };
      }),
    };
  }

  it("excludes a confirmed duplicate from totals, keeps both on request and restores either as unreviewed", () => {
    const store = withCandidates();
    expect(spendingTotals(store.entries).unclassified.unreviewed).toMatchObject({ gross: 34000, count: 5 });
    const decided = value(applyDuplicateDecisions(store, [{ entry_id: "tx_006", action: "exclude" }, { entry_id: "tx_007", action: "keep_both" }], NOW)).store;
    expect(entry(decided, "tx_006")).toMatchObject({ duplicate: { status: "excluded", of_entry_id: "tx_001" }, review_state: "reviewed" });
    expect(entry(decided, "tx_007")).toMatchObject({ duplicate: { status: "kept", of_entry_id: "tx_002" }, review_state: "unreviewed" });
    expect(spendingTotals(decided.entries).unclassified.unreviewed).toMatchObject({ gross: 29000, count: 4 });
    expect(spendingTotals(decided.entries).unclassified.reviewed.count).toBe(0);
    expectValid(decided);

    const restored = value(restoreDuplicates(decided, ["tx_006", "tx_007"], LATER)).store;
    expect(entry(restored, "tx_006")).toMatchObject({ duplicate: { status: "candidate" }, review_state: "unreviewed" });
    expect(entry(restored, "tx_007")).toMatchObject({ duplicate: { status: "candidate" }, review_state: "unreviewed" });
    expect(restored.history.map((record) => record.kind)).toEqual(["duplicate_excluded", "duplicate_kept", "duplicate_restored", "duplicate_restored"]);
  });

  it("rejects self references and exclusion chains, and applies nothing when one decision fails", () => {
    const store = withCandidates();
    expect(applyDuplicateDecisions(store, [{ entry_id: "tx_001", action: "exclude", of_entry_id: "tx_001" }], NOW)).toEqual({ ok: false, error: ["tx_001 cannot be a duplicate of itself."] });
    const chain = applyDuplicateDecisions(store, [{ entry_id: "tx_006", action: "exclude" }, { entry_id: "tx_001", action: "exclude", of_entry_id: "tx_006" }], NOW);
    expect(chain.ok).toBe(false);
    expect(chain.ok ? [] : chain.error).toContain(
      "tx_006 is excluded as a duplicate of tx_001, which is itself excluded as a duplicate of tx_006; no retained entry would remain.",
    );
    expect(applyDuplicateDecisions(store, [{ entry_id: "tx_001", action: "keep_both" }], NOW)).toEqual({ ok: false, error: ["tx_001 is not a duplicate candidate."] });
    expect(restoreDuplicates(store, ["tx_006"], NOW)).toEqual({ ok: false, error: ["tx_006 has no duplicate decision to reverse."] });
  });

  it("can mark any entry as a duplicate of another entry", () => {
    const store = storeWith(WEEK_ROWS);
    const excluded = value(applyDuplicateDecisions(store, [{ entry_id: "tx_002", action: "exclude", of_entry_id: "tx_001" }], NOW)).store;
    expect(entry(excluded, "tx_002").duplicate).toEqual({ status: "excluded", of_entry_id: "tx_001" });
    expect(applyDuplicateDecisions(store, [{ entry_id: "tx_002", action: "exclude" }], NOW)).toEqual({ ok: false, error: ["Choose the retained entry that tx_002 duplicates."] });
  });
});

describe("weekly review closure", () => {
  it("closes with unresolved entries, preserves notes and flags later changes", () => {
    let store = storeWith(WEEK_ROWS);
    store = value(confirmEntries(store, ["tx_001"], { acceptUnclassified: true }, NOW)).store;
    store = saveReflection(store, WEEK, { stood_out: " Groceries were low ", next_change: "" }, NOW).store;
    store = closeReview(store, WEEK, NOW).store;
    expect(store.entries.filter((candidate) => candidate.review_state === "unreviewed").map((candidate) => candidate.id)).toEqual(["tx_002", "tx_003", "tx_004", "tx_005"]);
    expect(reviewStatus(store, WEEK)).toMatchObject({ state: "closed" });
    expect(store.reviews[0]?.reflection).toEqual({ stood_out: "Groceries were low" });
    expectValid(store);

    store = value(applyEntryCorrection(store, { entries: [{ id: "tx_002", classification: spending(store, "culture", "Books") }], review: "unreviewed" }, LATER)).store;
    store = createImportedEntry(store, "acct_001", { posted_date: "2026-10-25" as IsoDate, description: "CINEMA", currency: "GBP", source_movement: "outflow", amount: pence(1200) }, LATER).store;
    createImportedEntry(store, "acct_001", { posted_date: "2026-10-26" as IsoDate, description: "NEXT WEEK", currency: "GBP", source_movement: "outflow", amount: pence(100) }, LATER);
    expect(reviewStatus(store, WEEK)).toMatchObject({ state: "changed_since_review", added: ["tx_006"], removed: [], revised: ["tx_002"] });

    const reclosed = closeReview(store, WEEK, LATER).store;
    expect(reclosed.reviews[0]?.closures.map((closure) => closure.closed_at)).toEqual([NOW, LATER]);
    expect(reclosed.reviews[0]?.reflection).toEqual({ stood_out: "Groceries were low" });
    expect(reviewStatus(reclosed, WEEK).state).toBe("closed");
    expect(reclosed.history.filter((record) => record.subject_type === "review").map((record) => record.kind)).toEqual(["review_reflection_saved", "review_closed", "review_closed"]);
  });

  it("is not closed until an explicit close, even with a saved reflection", () => {
    const store = saveReflection(storeWith(WEEK_ROWS), WEEK, { next_change: "Cook twice" }, NOW).store;
    expect(reviewStatus(store, WEEK)).toEqual({ state: "not_closed" });
  });
});
