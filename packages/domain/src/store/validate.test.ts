import { describe, expect, it } from "vitest";
import { pence } from "../money/pence.ts";
import { createEmptyStore, savingsGoal } from "./create.ts";
import { validateStore } from "./validate.ts";

const NOW = "2026-10-28T10:00:00.000Z";

function errorsOf(value: unknown): string[] {
  const result = validateStore(value);
  if (result.ok) {
    throw new Error("expected validation to fail");
  }
  return result.error.map((error) => error.path);
}

describe("validateStore", () => {
  it("accepts a freshly created store and round-trips through JSON", () => {
    const store = createEmptyStore(NOW);
    expect(validateStore(store).ok).toBe(true);
    const roundTripped: unknown = JSON.parse(JSON.stringify(store));
    const result = validateStore(roundTripped);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(store);
      expect(savingsGoal(result.value).name).toBe("Savings");
      expect(result.value.categories).toHaveLength(12);
    }
  });

  it("rejects an unsupported schema version without throwing", () => {
    const store = { ...createEmptyStore(NOW), schema_version: 99 };
    const result = validateStore(store);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0]?.path).toBe("schema_version");
      expect(result.error[0]?.message).toContain("newer");
    }
  });

  it("rejects non-object input and missing collections", () => {
    expect(errorsOf("not a store")).toEqual(["$"]);
    expect(errorsOf(null)).toEqual(["$"]);
    const { entries: _entries, ...withoutEntries } = createEmptyStore(NOW);
    expect(errorsOf(withoutEntries)).toEqual(["entries"]);
  });

  it("rejects fractional pence and unknown goals inside a plan revision", () => {
    const base = createEmptyStore(NOW);
    const store = {
      ...base,
      plans: [
        {
          month: "2026-10",
          revisions: [
            {
              revision: 1,
              planning_income: 500.5,
              fixed_commitments: pence(10000),
              plan_funded_goal_allocations: [{ goal_id: "goal_999", amount: pence(10000) }],
              envelopes: { needs: pence(15000), wants: pence(10000), culture: pence(2500), unexpected: pence(2500) },
              confirmed_at: NOW,
            },
          ],
        },
      ],
    };
    expect(errorsOf(store)).toEqual([
      "plans[0].revisions[0].planning_income",
      "plans[0].revisions[0].plan_funded_goal_allocations[0].goal_id",
    ]);
  });

  it("ignores unknown keys so later additions stay readable", () => {
    const store = { ...createEmptyStore(NOW), future_collection: [] };
    expect(validateStore(store).ok).toBe(true);
  });
});
