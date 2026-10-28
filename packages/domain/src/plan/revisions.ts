import type { Month } from "../periods/periods.ts";
import { nextId } from "../store/ids.ts";
import type { HistoryRecord, MonthPlan, PlanRevision, Store, Timestamp } from "../store/schema.ts";
import type { ValidatedPlan } from "./plan.ts";

export function monthPlan(store: Store, month: Month): MonthPlan | undefined {
  return store.plans.find((plan) => plan.month === month);
}

/** The latest confirmed revision for a month, if any. */
export function currentPlanRevision(store: Store, month: Month): PlanRevision | undefined {
  const plan = monthPlan(store, month);
  return plan?.revisions[plan.revisions.length - 1];
}

export type PlanRevisionResult = {
  readonly store: Store;
  readonly revision: PlanRevision;
  readonly history: HistoryRecord;
};

/**
 * Append a confirmed revision for the month and record the change in history.
 * Earlier revisions and other months are untouched (Financial Model §12). Returns a new store.
 */
export function addPlanRevision(store: Store, month: Month, plan: ValidatedPlan, now: Timestamp): PlanRevisionResult {
  const existing = monthPlan(store, month);
  const previous = currentPlanRevision(store, month);
  const revision: PlanRevision = {
    revision: (previous?.revision ?? 0) + 1,
    planning_income: plan.planning_income,
    fixed_commitments: plan.fixed_commitments,
    plan_funded_goal_allocations: plan.plan_funded_goal_allocations.map((allocation) => ({ ...allocation })),
    envelopes: { ...plan.envelopes },
    ...(plan.intention !== undefined && plan.intention !== "" ? { intention: plan.intention } : {}),
    confirmed_at: now,
  };

  const plans: MonthPlan[] =
    existing === undefined
      ? [...store.plans, { month, revisions: [revision] }]
      : store.plans.map((candidate) =>
          candidate === existing ? { month, revisions: [...candidate.revisions, revision] } : candidate,
        );

  const withId = nextId(store, "hist");
  const history: HistoryRecord = {
    id: withId.id,
    at: now,
    kind: "plan_confirmed",
    subject_type: "plan",
    subject_id: month,
    before: previous ?? null,
    after: revision,
  };

  return {
    store: { ...withId.store, plans, history: [...store.history, history] },
    revision,
    history,
  };
}
