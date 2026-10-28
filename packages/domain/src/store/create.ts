import type { Treatment } from "../classification/vocabulary.ts";
import { nextId } from "./ids.ts";
import { SCHEMA_VERSION, STORE_CURRENCY, type Category, type Goal, type Store, type Timestamp } from "./schema.ts";

export const SAVINGS_GOAL_NAME = "Savings";

/** Initial categories per treatment (PRD §4.3 examples plus Financial Model §5.3 examples). */
export const INITIAL_CATEGORIES: readonly { readonly treatment: Treatment; readonly name: string }[] = [
  { treatment: "fixed", name: "Housing" },
  { treatment: "fixed", name: "Utilities" },
  { treatment: "needs", name: "Groceries" },
  { treatment: "needs", name: "Transport" },
  { treatment: "wants", name: "Eating out" },
  { treatment: "wants", name: "Shopping" },
  { treatment: "culture", name: "Books" },
  { treatment: "culture", name: "Cinema" },
  { treatment: "unexpected", name: "Repairs" },
  { treatment: "goal", name: "Savings" },
  { treatment: "outside_plan", name: "Credit-card payment" },
  { treatment: "unclassified", name: "Uncategorised" },
];

/** A new, empty store with the seeded categories and the single Savings goal. */
export function createEmptyStore(now: Timestamp): Store {
  let store: Store = {
    schema_version: SCHEMA_VERSION,
    currency: STORE_CURRENCY,
    created_at: now,
    counters: {},
    accounts: [],
    mappings: [],
    imports: [],
    source_records: [],
    entries: [],
    categories: [],
    goals: [],
    plans: [],
    goal_contribution_links: [],
    reviews: [],
    history: [],
  };

  const categories: Category[] = [];
  for (const seed of INITIAL_CATEGORIES) {
    const next = nextId(store, "cat");
    store = next.store;
    categories.push({ id: next.id, treatment: seed.treatment, name: seed.name, created_at: now });
  }

  const goalId = nextId(store, "goal");
  store = goalId.store;
  const savings: Goal = { id: goalId.id, name: SAVINGS_GOAL_NAME, kind: "plan_funded", status: "active", created_at: now };

  return { ...store, categories, goals: [savings] };
}

/** The single plan-funded Savings goal. Throws if the store does not hold exactly one. */
export function savingsGoal(store: Store): Goal {
  const goals = store.goals.filter((goal) => goal.kind === "plan_funded");
  const goal = goals[0];
  if (goal === undefined || goals.length !== 1) {
    throw new Error(`Expected exactly one plan-funded goal, found ${goals.length}`);
  }
  return goal;
}
