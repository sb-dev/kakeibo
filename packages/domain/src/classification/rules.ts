import type { SourceMovement, Store } from "../store/schema.ts";
import { ENVELOPES, TREATMENT_LABELS, type Movement, type Purpose, type Treatment } from "./vocabulary.ts";

/** The editable classification of an entry. Its source values are never edited here. */
export type Classification = {
  readonly movement: Movement;
  readonly purpose: Purpose;
  readonly treatment: Treatment;
  readonly category_id: string;
};

/**
 * Entry types offered to the user: one movement and purpose pair each (Financial Model §3).
 * A refund is an inflow that reduces spending; it is never income (§3.3).
 * A Savings-goal contribution is a transfer the user links explicitly (§6.3).
 */
export const ENTRY_TYPES = [
  { id: "spending", name: "Spending", label: "Spending", movement: "outflow", purpose: "spending", directions: ["outflow"] },
  { id: "refund", name: "Refund", label: "Refund (reduces spending; not income)", movement: "inflow", purpose: "refund", directions: ["inflow"] },
  { id: "income", name: "Income", label: "Income", movement: "inflow", purpose: "income", directions: ["inflow"] },
  {
    id: "transfer",
    name: "Transfer",
    label: "Transfer between own accounts or card settlement (not spending)",
    movement: "transfer",
    purpose: "transfer",
    directions: ["inflow", "outflow"],
  },
  {
    id: "goal_contribution",
    name: "Goal contribution",
    label: "Contribution to the Savings goal (a transfer)",
    movement: "transfer",
    purpose: "goal_contribution",
    directions: ["inflow", "outflow"],
  },
  { id: "adjustment", name: "Adjustment", label: "Adjustment", movement: "adjustment", purpose: "adjustment", directions: ["inflow", "outflow"] },
] as const satisfies readonly {
  readonly id: string;
  /** Short name for tables. */
  readonly name: string;
  /** Explanatory label for prompts. */
  readonly label: string;
  readonly movement: Movement;
  readonly purpose: Purpose;
  readonly directions: readonly SourceMovement[];
}[];

export type EntryType = (typeof ENTRY_TYPES)[number];

/** Entry types that fit the direction of the source row. */
export function entryTypesFor(direction: SourceMovement): EntryType[] {
  return ENTRY_TYPES.filter((type) => (type.directions as readonly SourceMovement[]).includes(direction));
}

/** The entry type for a movement and purpose pair, if it is one the CLI offers. */
export function entryTypeOf(classification: Pick<Classification, "movement" | "purpose">): EntryType | undefined {
  return ENTRY_TYPES.find((type) => type.movement === classification.movement && type.purpose === classification.purpose);
}

const SPENDING_TREATMENTS: readonly Treatment[] = ["fixed", ...ENVELOPES, "outside_plan", "unclassified"];

/**
 * Plan treatments that fit a purpose. Transfers never consume an envelope (Financial Model §9);
 * a goal contribution is the only Goal treatment (§3.2).
 */
export function allowedTreatments(purpose: Purpose): readonly Treatment[] {
  switch (purpose) {
    case "spending":
    case "refund":
      return SPENDING_TREATMENTS;
    case "income":
      return ["outside_plan", "unclassified"];
    case "transfer":
    case "adjustment":
      return ["outside_plan"];
    case "goal_contribution":
      return ["goal"];
  }
}

/** Plain-words problems with a classification for a row of the given direction; empty when valid. */
export function classificationProblems(store: Store, classification: Classification, direction: SourceMovement): string[] {
  const problems: string[] = [];
  const type = entryTypeOf(classification);
  if (type === undefined) {
    problems.push(`movement ${classification.movement} does not fit purpose ${classification.purpose}`);
  } else if (!(type.directions as readonly SourceMovement[]).includes(direction)) {
    problems.push(`${type.id} does not fit money ${direction === "inflow" ? "in" : "out"}`);
  }
  if (!allowedTreatments(classification.purpose).includes(classification.treatment)) {
    problems.push(`${TREATMENT_LABELS[classification.treatment]} does not fit purpose ${classification.purpose}`);
  }
  const category = store.categories.find((candidate) => candidate.id === classification.category_id);
  if (category === undefined) {
    problems.push(`unknown category ${classification.category_id}`);
  } else if (category.treatment !== classification.treatment) {
    problems.push(`category ${category.name} belongs to ${TREATMENT_LABELS[category.treatment]}, not ${TREATMENT_LABELS[classification.treatment]}`);
  }
  return problems;
}
