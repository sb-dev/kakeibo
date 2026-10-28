import { ENVELOPES, TREATMENTS } from "../classification/vocabulary.ts";
import { addPence, subPence, sumPence, type Pence } from "../money/pence.ts";
import type { IsoDate } from "../periods/periods.ts";
import type { Entry, Store } from "../store/schema.ts";
import {
  combineSplits,
  countsAsSpending,
  entriesInRange,
  goalContributions,
  isDuplicateCandidate,
  isExcludedDuplicate,
  spendingTotals,
  splitTotal,
  type GoalContribution,
  type ReviewSplit,
  type SpendingTotals,
} from "../review/totals.ts";

export type ObservedIncome = {
  readonly reviewed: Pence;
  readonly unreviewed: Pence;
  readonly count: number;
};

/**
 * Observed totals for an inclusive date range (PRD §4.5, Financial Model §11), derived from entries
 * with the same rules as the weekly review. Planned amounts are not part of it.
 */
export type PeriodSummary = {
  readonly from: IsoDate;
  readonly to: IsoDate;
  /** Every entry posted in the range, including excluded duplicates. */
  readonly entries: readonly Entry[];
  readonly spending: SpendingTotals;
  /** Needs, Wants, Culture and Unexpected together. */
  readonly flexible: ReviewSplit;
  /** Every spending treatment together. */
  readonly overall: ReviewSplit;
  /** Purpose `income` only: a refund is never income (§3.3). */
  readonly income: ObservedIncome;
  /** Transfers are not spending or income. */
  readonly transfers: { readonly amount: Pence; readonly count: number };
  /** Explicitly linked Savings-goal contributions, counted once per link. */
  readonly contributions: readonly GoalContribution[];
  /** Confirmed duplicates; they contribute zero. */
  readonly excluded_duplicates: readonly Entry[];
  readonly unreviewed_count: number;
  readonly unclassified_count: number;
  readonly duplicate_candidate_count: number;
  /** Observed income minus net spending. Net spending already includes refunds, so they count once (§11). */
  readonly income_minus_net_spending: Pence;
};

export function periodSummary(store: Store, from: IsoDate, to: IsoDate): PeriodSummary {
  const entries = entriesInRange(store, from, to);
  const counted = entries.filter((entry) => !isExcludedDuplicate(entry));
  const spending = spendingTotals(entries);
  const overall = combineSplits(TREATMENTS.map((treatment) => spending[treatment]));
  const incomeEntries = counted.filter((entry) => entry.purpose === "income");
  const amount = (chosen: readonly Entry[]): Pence => sumPence(chosen.map((entry) => entry.source.amount));
  const income: ObservedIncome = {
    reviewed: amount(incomeEntries.filter((entry) => entry.review_state === "reviewed")),
    unreviewed: amount(incomeEntries.filter((entry) => entry.review_state === "unreviewed")),
    count: incomeEntries.length,
  };
  const transfers = counted.filter((entry) => entry.purpose === "transfer");
  return {
    from,
    to,
    entries,
    spending,
    flexible: combineSplits(ENVELOPES.map((envelope) => spending[envelope])),
    overall,
    income,
    transfers: { amount: amount(transfers), count: transfers.length },
    contributions: goalContributions(store, from, to),
    excluded_duplicates: entries.filter(isExcludedDuplicate),
    unreviewed_count: counted.filter((entry) => entry.review_state === "unreviewed").length,
    unclassified_count: counted.filter((entry) => entry.treatment === "unclassified").length,
    duplicate_candidate_count: counted.filter(isDuplicateCandidate).length,
    income_minus_net_spending: subPence(addPence(income.reviewed, income.unreviewed), splitTotal(overall).net),
  };
}

/** Entries that contribute to spending for one treatment and, optionally, one category. */
export function spendingEntries(entries: readonly Entry[], treatment: Entry["treatment"], categoryId?: string): Entry[] {
  return entries.filter((entry) => countsAsSpending(entry) && entry.treatment === treatment && (categoryId === undefined || entry.category_id === categoryId));
}

/** reviewed remaining = envelope limit − reviewed net spending. May exceed the limit after refunds. */
export function reviewedRemaining(limit: Pence, split: ReviewSplit): Pence {
  return subPence(limit, split.reviewed.net);
}
