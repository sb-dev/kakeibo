import { ENVELOPES } from "../classification/vocabulary.ts";
import { formatPence, subPence, sumPence, type Pence } from "../money/pence.ts";
import { err, ok, type Result } from "../result.ts";
import type { EnvelopeLimits, GoalAllocation } from "../store/schema.ts";

/** User-entered plan values before validation. */
export type PlanInput = {
  readonly planning_income: Pence;
  readonly fixed_commitments: Pence;
  readonly plan_funded_goal_allocations: readonly GoalAllocation[];
  readonly envelopes: EnvelopeLimits;
  readonly intention?: string;
};

/** A plan that satisfies both planning equations and non-negativity. */
export type ValidatedPlan = PlanInput & { readonly __validated: true };

export type PlanValidationError =
  | { readonly code: "negative_amount"; readonly field: string; readonly amount: Pence }
  | { readonly code: "flexible_budget_negative"; readonly flexible_budget: Pence }
  | {
      readonly code: "envelopes_do_not_balance";
      readonly flexible_budget: Pence;
      readonly envelope_total: Pence;
      readonly difference: Pence;
    };

/** Σ plan_funded_goal_allocations (Financial Model §5, §6.1). */
export function goalAllocationTotal(plan: Pick<PlanInput, "plan_funded_goal_allocations">): Pence {
  return sumPence(plan.plan_funded_goal_allocations.map((allocation) => allocation.amount));
}

/** flexible_spending_budget = planning_income − fixed_commitments − plan_funded_goal_allocations. */
export function flexibleBudget(plan: PlanInput): Pence {
  return subPence(subPence(plan.planning_income, plan.fixed_commitments), goalAllocationTotal(plan));
}

/** envelope_limits_total = needs + wants + culture + unexpected. */
export function envelopeTotal(envelopes: EnvelopeLimits): Pence {
  return sumPence(ENVELOPES.map((envelope) => envelopes[envelope]));
}

/**
 * Accept the plan only when every amount is non-negative and
 * envelope_limits_total = flexible_spending_budget (Financial Model §5, PRD §4.2).
 * Never rebalances anything on the user's behalf.
 */
export function validatePlan(plan: PlanInput): Result<ValidatedPlan, readonly PlanValidationError[]> {
  const errors: PlanValidationError[] = [];
  const amounts: readonly [string, Pence][] = [
    ["planning_income", plan.planning_income],
    ["fixed_commitments", plan.fixed_commitments],
    ...plan.plan_funded_goal_allocations.map(
      (allocation): [string, Pence] => [`plan_funded_goal_allocations.${allocation.goal_id}`, allocation.amount],
    ),
    ...ENVELOPES.map((envelope): [string, Pence] => [`envelopes.${envelope}`, plan.envelopes[envelope]]),
  ];
  for (const [field, amount] of amounts) {
    if (amount < 0) {
      errors.push({ code: "negative_amount", field, amount });
    }
  }
  if (errors.length > 0) {
    return err(errors);
  }

  const flexible = flexibleBudget(plan);
  if (flexible < 0) {
    return err([{ code: "flexible_budget_negative", flexible_budget: flexible }]);
  }
  const total = envelopeTotal(plan.envelopes);
  if (total !== flexible) {
    return err([
      {
        code: "envelopes_do_not_balance",
        flexible_budget: flexible,
        envelope_total: total,
        difference: subPence(flexible, total),
      },
    ]);
  }
  return ok({ ...plan, __validated: true } as ValidatedPlan);
}

/** Plain-words description of a validation error, for prompts and reports. */
export function describePlanError(error: PlanValidationError): string {
  switch (error.code) {
    case "negative_amount":
      return `${error.field} is ${formatPence(error.amount)}; amounts must not be negative.`;
    case "flexible_budget_negative":
      return `Fixed commitments and the savings allocation exceed planned income by ${formatPence(
        subPence(0 as Pence, error.flexible_budget),
      )}.`;
    case "envelopes_do_not_balance": {
      const difference = error.difference;
      const detail =
        difference > 0
          ? `${formatPence(difference)} unallocated`
          : `${formatPence(subPence(0 as Pence, difference))} over-allocated`;
      return `Envelopes total ${formatPence(error.envelope_total)} but the flexible budget is ${formatPence(
        error.flexible_budget,
      )} (${detail}).`;
    }
  }
}
