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

/**
 * Gross spending, refunds and net spending per treatment, split by review state.
 * A refund reduces spending in its own treatment and posted period and is never income (§3.3).
 */
export function spendingTotals(entries: readonly Entry[]): SpendingTotals {
  const totals = Object.fromEntries(TREATMENTS.map((treatment) => [treatment, { reviewed: ZERO, unreviewed: ZERO }])) as Record<Treatment, ReviewSplit>;
  for (const entry of entries) {
    if (!countsAsSpending(entry)) continue;
    const split = totals[entry.treatment];
    totals[entry.treatment] =
      entry.review_state === "reviewed" ? { ...split, reviewed: add(split.reviewed, entry) } : { ...split, unreviewed: add(split.unreviewed, entry) };
  }
  return totals;
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
