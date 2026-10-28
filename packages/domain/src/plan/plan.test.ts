import { describe, expect, it } from "vitest";
import { pence, type Pence } from "../money/pence.ts";
import type { Month } from "../periods/periods.ts";
import { createEmptyStore, savingsGoal } from "../store/create.ts";
import { validateStore } from "../store/validate.ts";
import { describePlanError, envelopeTotal, flexibleBudget, validatePlan, type PlanInput } from "./plan.ts";
import { addPlanRevision, currentPlanRevision } from "./revisions.ts";

const NOW = "2026-10-28T10:00:00.000Z";
const OCTOBER = "2026-10" as Month;
const GOAL = "goal_001";

/** PRD §7 fixture: income £500, fixed £100, savings £100 → £300 flexible. */
function prdPlan(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    planning_income: pence(50000),
    fixed_commitments: pence(10000),
    plan_funded_goal_allocations: [{ goal_id: GOAL, amount: pence(10000) }],
    envelopes: { needs: pence(15000), wants: pence(10000), culture: pence(2500), unexpected: pence(2500) },
    intention: "Cook at home on weekdays",
    ...overrides,
  };
}

function failure(plan: PlanInput) {
  const result = validatePlan(plan);
  if (result.ok) {
    throw new Error("expected validation to fail");
  }
  return result.error;
}

describe("plan equations", () => {
  it("computes the flexible budget from income, fixed commitments and the goal allocation", () => {
    expect(flexibleBudget(prdPlan())).toBe(30000);
    expect(envelopeTotal(prdPlan().envelopes)).toBe(30000);
  });

  it("accepts the PRD plan with £300 allocated across the four envelopes", () => {
    const result = validatePlan(prdPlan());
    expect(result.ok).toBe(true);
  });

  it("rejects envelopes totalling £299 and reports the £1.00 gap", () => {
    const errors = failure(
      prdPlan({ envelopes: { needs: pence(15000), wants: pence(10000), culture: pence(2500), unexpected: pence(2400) } }),
    );
    expect(errors).toEqual([
      { code: "envelopes_do_not_balance", flexible_budget: 30000, envelope_total: 29900, difference: 100 },
    ]);
    expect(describePlanError(errors[0]!)).toBe(
      "Envelopes total £299.00 but the flexible budget is £300.00 (£1.00 unallocated).",
    );
  });

  it("rejects over-allocated envelopes", () => {
    const errors = failure(
      prdPlan({ envelopes: { needs: pence(15000), wants: pence(10000), culture: pence(2500), unexpected: pence(2600) } }),
    );
    expect(errors[0]?.code).toBe("envelopes_do_not_balance");
    expect(describePlanError(errors[0]!)).toContain("£1.00 over-allocated");
  });

  it("rejects negative amounts before checking balance", () => {
    const errors = failure(
      prdPlan({ envelopes: { needs: pence(-500), wants: pence(10000), culture: pence(2500), unexpected: pence(18000) } }),
    );
    expect(errors).toEqual([{ code: "negative_amount", field: "envelopes.needs", amount: -500 }]);
    expect(failure(prdPlan({ fixed_commitments: pence(-1) }))[0]).toEqual({
      code: "negative_amount",
      field: "fixed_commitments",
      amount: -1,
    });
    expect(failure(prdPlan({ plan_funded_goal_allocations: [{ goal_id: GOAL, amount: pence(-1) }] }))[0]?.code).toBe(
      "negative_amount",
    );
  });

  it("rejects fixed commitments and savings that exceed income", () => {
    const errors = failure(prdPlan({ fixed_commitments: pence(45000) }));
    expect(errors).toEqual([{ code: "flexible_budget_negative", flexible_budget: -5000 }]);
    expect(describePlanError(errors[0]!)).toContain("exceed planned income by £50.00");
  });

  it("accepts a plan with no fixed commitments and no savings allocation", () => {
    const result = validatePlan(
      prdPlan({
        fixed_commitments: pence(0),
        plan_funded_goal_allocations: [{ goal_id: GOAL, amount: pence(0) }],
        envelopes: { needs: pence(50000), wants: pence(0), culture: pence(0), unexpected: pence(0) },
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe("plan revisions", () => {
  it("saves a first revision against the Savings goal and records history", () => {
    const store = createEmptyStore(NOW);
    const goal = savingsGoal(store);
    const validated = validatePlan(prdPlan({ plan_funded_goal_allocations: [{ goal_id: goal.id, amount: pence(10000) }] }));
    if (!validated.ok) throw new Error("fixture must validate");

    const result = addPlanRevision(store, OCTOBER, validated.value, NOW);
    expect(result.revision.revision).toBe(1);
    expect(result.revision.plan_funded_goal_allocations).toEqual([{ goal_id: goal.id, amount: 10000 }]);
    expect(currentPlanRevision(result.store, OCTOBER)).toEqual(result.revision);
    expect(result.history).toMatchObject({ kind: "plan_confirmed", subject_id: "2026-10", before: null });
    expect(result.history.after).toEqual(result.revision);
    expect(result.store.history).toHaveLength(1);
    expect(validateStore(result.store).ok).toBe(true);
    // The original store is not mutated.
    expect(store.plans).toHaveLength(0);
  });

  it("appends revision 2, keeps revision 1 and records before/after", () => {
    const store = createEmptyStore(NOW);
    const first = validatePlan(prdPlan());
    const second = validatePlan(
      prdPlan({
        planning_income: pence(60000),
        envelopes: { needs: pence(20000), wants: pence(15000), culture: pence(2500), unexpected: pence(2500) },
        intention: "",
      }),
    );
    if (!first.ok || !second.ok) throw new Error("fixtures must validate");

    const afterFirst = addPlanRevision(store, OCTOBER, first.value, NOW);
    const afterSecond = addPlanRevision(afterFirst.store, OCTOBER, second.value, "2026-10-29T09:00:00.000Z");

    const plan = afterSecond.store.plans.find((candidate) => candidate.month === OCTOBER);
    expect(plan?.revisions.map((revision) => revision.revision)).toEqual([1, 2]);
    expect(plan?.revisions[0]).toEqual(afterFirst.revision);
    expect(plan?.revisions[1]?.planning_income).toBe(60000);
    expect(plan?.revisions[1]?.intention).toBeUndefined();
    expect(afterSecond.history.before).toEqual(afterFirst.revision);
    expect(afterSecond.history.id).toBe("hist_002");
    expect(afterSecond.store.plans).toHaveLength(1);
    expect(validateStore(afterSecond.store).ok).toBe(true);
  });

  it("keeps other months separate", () => {
    const store = createEmptyStore(NOW);
    const validated = validatePlan(prdPlan());
    if (!validated.ok) throw new Error("fixture must validate");
    const october = addPlanRevision(store, OCTOBER, validated.value, NOW);
    const november = addPlanRevision(october.store, "2026-11" as Month, validated.value, NOW);
    expect(november.store.plans.map((plan) => plan.month)).toEqual(["2026-10", "2026-11"]);
    expect(currentPlanRevision(november.store, OCTOBER)?.revision).toBe(1);
    expect(currentPlanRevision(november.store, "2026-11" as Month)?.revision).toBe(1);
    expect(currentPlanRevision(november.store, "2026-12" as Month)).toBeUndefined();
  });
});

describe("Pence brand", () => {
  it("is a plain number at runtime", () => {
    const value: Pence = pence(5);
    expect(typeof value).toBe("number");
  });
});
