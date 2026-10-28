import { TREATMENTS, type Treatment } from "../classification/vocabulary.ts";
import { addPence, pence, subPence, type Pence } from "../money/pence.ts";
import type { IsoDate } from "../periods/periods.ts";
import type { Entry, GoalContributionLink, Store } from "../store/schema.ts";

/** Spending amounts for one group of entries (Financial Model §11). */
export type SpendingAmounts = {
  readonly gross: Pence;
  readonly refunds: Pence;
  /** net = gross − refunds. May be negative. */
  readonly net: Pence;
  readonly count: number;
};

export type ReviewSplit = {
  readonly reviewed: SpendingAmounts;
  readonly unreviewed: SpendingAmounts;
};

export type SpendingTotals = Readonly<Record<Treatment, ReviewSplit>>;

const ZERO: SpendingAmounts = { gross: pence(0), refunds: pence(0), net: pence(0), count: 0 };

function entryNumber(id: string): number {
  return Number.parseInt(id.slice(id.indexOf("_") + 1), 10);
}

/** Posted date, then creation order. */
export function compareEntries(a: Entry, b: Entry): number {
  if (a.source.posted_date !== b.source.posted_date) return a.source.posted_date < b.source.posted_date ? -1 : 1;
  return entryNumber(a.id) - entryNumber(b.id);
}

/** Entries posted from `from` to `to` inclusive, by posted date (calendar dates, no timezone). */
export function entriesInRange(store: Store, from: IsoDate, to: IsoDate): Entry[] {
  return store.entries.filter((entry) => from <= entry.source.posted_date && entry.source.posted_date <= to).sort(compareEntries);
}

export function isExcludedDuplicate(entry: Entry): boolean {
  return entry.duplicate?.status === "excluded";
}

export function isDuplicateCandidate(entry: Entry): boolean {
  return entry.duplicate?.status === "candidate";
}

/**
 * Whether an entry contributes to spending totals: spending and refund purposes only.
 * Income, transfers, goal contributions and adjustments never become spending, and a
 * confirmed duplicate contributes zero. A duplicate candidate still counts (as unreviewed).
 */
export function countsAsSpending(entry: Entry): boolean {
  return (entry.purpose === "spending" || entry.purpose === "refund") && !isExcludedDuplicate(entry);
}

function add(amounts: SpendingAmounts, entry: Entry): SpendingAmounts {
  const refund = entry.purpose === "refund";
  return {
    gross: refund ? amounts.gross : addPence(amounts.gross, entry.source.amount),
    refunds: refund ? addPence(amounts.refunds, entry.source.amount) : amounts.refunds,
    net: refund ? subPence(amounts.net, entry.source.amount) : addPence(amounts.net, entry.source.amount),
    count: amounts.count + 1,
  };
}

function addSplit(split: ReviewSplit, entry: Entry): ReviewSplit {
  return entry.review_state === "reviewed" ? { ...split, reviewed: add(split.reviewed, entry) } : { ...split, unreviewed: add(split.unreviewed, entry) };
}

/**
 * Gross spending, refunds and net spending per treatment, split by review state.
 * A refund reduces spending in its own treatment and posted period and is never income (§3.3).
 */
export function spendingTotals(entries: readonly Entry[]): SpendingTotals {
  const totals = Object.fromEntries(TREATMENTS.map((treatment) => [treatment, { reviewed: ZERO, unreviewed: ZERO }])) as Record<Treatment, ReviewSplit>;
  for (const entry of entries) {
    if (!countsAsSpending(entry)) continue;
    totals[entry.treatment] = addSplit(totals[entry.treatment], entry);
  }
  return totals;
}

export type CategorySpending = {
  readonly category_id: string;
  readonly split: ReviewSplit;
};

/**
 * The same totals for one treatment, by category, in first-seen order. Category totals add up to
 * the treatment's totals in `spendingTotals`, so a drill-down reconciles with its summary row.
 */
export function categorySpendingTotals(entries: readonly Entry[], treatment: Treatment): CategorySpending[] {
  const totals = new Map<string, ReviewSplit>();
  for (const entry of entries) {
    if (!countsAsSpending(entry) || entry.treatment !== treatment) continue;
    totals.set(entry.category_id, addSplit(totals.get(entry.category_id) ?? { reviewed: ZERO, unreviewed: ZERO }, entry));
  }
  return [...totals].map(([category_id, split]) => ({ category_id, split }));
}

function sumAmounts(a: SpendingAmounts, b: SpendingAmounts): SpendingAmounts {
  return { gross: addPence(a.gross, b.gross), refunds: addPence(a.refunds, b.refunds), net: addPence(a.net, b.net), count: a.count + b.count };
}

/** Several splits added together, for example the four envelopes as the flexible total. */
export function combineSplits(splits: readonly ReviewSplit[]): ReviewSplit {
  return splits.reduce((total, split) => ({ reviewed: sumAmounts(total.reviewed, split.reviewed), unreviewed: sumAmounts(total.unreviewed, split.unreviewed) }), {
    reviewed: ZERO,
    unreviewed: ZERO,
  });
}

/** Reviewed and unreviewed amounts together. */
export function splitTotal(split: ReviewSplit): SpendingAmounts {
  return sumAmounts(split.reviewed, split.unreviewed);
}

export type GoalContribution = {
  readonly link: GoalContributionLink;
  readonly entries: readonly Entry[];
  /** Counted once per link, even when both account sides are imported. */
  readonly amount: Pence;
  /** The earliest posted date of the linked entries. */
  readonly posted_date: IsoDate;
  /** Reviewed only when every linked entry is reviewed. */
  readonly reviewed: boolean;
};

/** Explicitly linked Savings-goal contributions dated within the range (Financial Model §6.3). */
export function goalContributions(store: Store, from: IsoDate, to: IsoDate): GoalContribution[] {
  const contributions: GoalContribution[] = [];
  for (const link of store.goal_contribution_links) {
    const entries = link.entry_ids
      .map((id) => store.entries.find((entry) => entry.id === id))
      .filter((entry): entry is Entry => entry !== undefined)
      .sort(compareEntries);
    const first = entries[0];
    if (first === undefined || first.source.posted_date < from || first.source.posted_date > to) continue;
    contributions.push({
      link,
      entries,
      amount: first.source.amount,
      posted_date: first.source.posted_date,
      reviewed: entries.every((entry) => entry.review_state === "reviewed"),
    });
  }
  return contributions;
}
