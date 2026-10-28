import type { Treatment } from "../classification/vocabulary.ts";
import type { Pence } from "../money/pence.ts";
import type { Month } from "../periods/periods.ts";

/**
 * Versioned local store. Keys use snake_case to mirror Financial Model §5 names.
 * Collections that later tasks populate (accounts, mappings, imports, source records,
 * entries, contribution links, reviews) are present but empty in schema version 1.
 */
export const SCHEMA_VERSION = 1;
export const STORE_CURRENCY = "GBP";

export const ID_PREFIXES = ["acct", "map", "imp", "src", "tx", "cat", "goal", "rev", "hist"] as const;
export type IdPrefix = (typeof ID_PREFIXES)[number];

/** ISO 8601 timestamp with timezone, e.g. 2026-10-28T10:01:02.000Z. */
export type Timestamp = string;

export type Category = {
  readonly id: string;
  readonly treatment: Treatment;
  readonly name: string;
  readonly created_at: Timestamp;
};

export type GoalKind = "plan_funded";
export type GoalStatus = "active";

/** The single plan-funded Savings goal (Financial Model §6.1). */
export type Goal = {
  readonly id: string;
  readonly name: string;
  readonly kind: GoalKind;
  readonly status: GoalStatus;
  readonly created_at: Timestamp;
};

export type GoalAllocation = {
  readonly goal_id: string;
  readonly amount: Pence;
};

export type EnvelopeLimits = {
  readonly needs: Pence;
  readonly wants: Pence;
  readonly culture: Pence;
  readonly unexpected: Pence;
};

/** One confirmed revision of a month's plan. Earlier revisions are retained. */
export type PlanRevision = {
  readonly revision: number;
  readonly planning_income: Pence;
  readonly fixed_commitments: Pence;
  readonly plan_funded_goal_allocations: readonly GoalAllocation[];
  readonly envelopes: EnvelopeLimits;
  readonly intention?: string;
  readonly confirmed_at: Timestamp;
};

export type MonthPlan = {
  readonly month: Month;
  readonly revisions: readonly PlanRevision[];
};

export type HistoryKind = "plan_confirmed";

/** Explains an explicit change: what changed, when and from/to what. */
export type HistoryRecord = {
  readonly id: string;
  readonly at: Timestamp;
  readonly kind: HistoryKind;
  readonly subject_type: "plan";
  readonly subject_id: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly note?: string;
};

export type Store = {
  readonly schema_version: typeof SCHEMA_VERSION;
  readonly currency: typeof STORE_CURRENCY;
  readonly created_at: Timestamp;
  readonly counters: Readonly<Partial<Record<IdPrefix, number>>>;
  readonly accounts: readonly unknown[];
  readonly mappings: readonly unknown[];
  readonly imports: readonly unknown[];
  readonly source_records: readonly unknown[];
  readonly entries: readonly unknown[];
  readonly categories: readonly Category[];
  readonly goals: readonly Goal[];
  readonly plans: readonly MonthPlan[];
  readonly goal_contribution_links: readonly unknown[];
  readonly reviews: readonly unknown[];
  readonly history: readonly HistoryRecord[];
};
