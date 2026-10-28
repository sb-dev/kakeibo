/**
 * Classification vocabulary from Financial Model §3 and §7.
 * Movement, purpose, plan treatment, category and review state are separate dimensions.
 */

export const MOVEMENTS = ["inflow", "outflow", "transfer", "adjustment"] as const;
export type Movement = (typeof MOVEMENTS)[number];

/** Financial purpose. A refund is an inflow that reduces spending; it is never income. */
export const PURPOSES = ["income", "spending", "refund", "transfer", "goal_contribution", "adjustment"] as const;
export type Purpose = (typeof PURPOSES)[number];

/** The four flexible envelopes in canonical order. */
export const ENVELOPES = ["needs", "wants", "culture", "unexpected"] as const;
export type Envelope = (typeof ENVELOPES)[number];

export const TREATMENTS = ["fixed", ...ENVELOPES, "goal", "outside_plan", "unclassified"] as const;
export type Treatment = (typeof TREATMENTS)[number];

export const TREATMENT_LABELS: Readonly<Record<Treatment, string>> = {
  fixed: "Fixed",
  needs: "Needs",
  wants: "Wants",
  culture: "Culture",
  unexpected: "Unexpected",
  goal: "Goal",
  outside_plan: "Outside plan",
  unclassified: "Unclassified",
};

export const REVIEW_STATES = ["unreviewed", "reviewed"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export function isTreatment(value: unknown): value is Treatment {
  return typeof value === "string" && (TREATMENTS as readonly string[]).includes(value);
}
