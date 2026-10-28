import { err, ok, type Result } from "../result.ts";
import { nextId } from "../store/ids.ts";
import type { Category, Store, Timestamp } from "../store/schema.ts";
import { TREATMENT_LABELS, type Treatment } from "./vocabulary.ts";

export const MAX_CATEGORY_NAME_LENGTH = 40;

/** The category with this name in a treatment, ignoring case. */
export function findCategory(store: Store, treatment: Treatment, name: string): Category | undefined {
  const wanted = name.trim().toLowerCase();
  return store.categories.find((category) => category.treatment === treatment && category.name.toLowerCase() === wanted);
}

/**
 * Add a user-defined category within a treatment (PRD §4.3). A category never replaces an envelope,
 * and Unclassified keeps its single Uncategorised category.
 */
export function addCategory(
  store: Store,
  treatment: Treatment,
  name: string,
  now: Timestamp,
): Result<{ readonly store: Store; readonly category: Category }, string> {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (treatment === "unclassified") {
    return err("Unclassified has only Uncategorised; choose a treatment for the new category.");
  }
  if (trimmed === "") {
    return err("Enter a category name.");
  }
  if (trimmed.length > MAX_CATEGORY_NAME_LENGTH) {
    return err(`Category names have at most ${MAX_CATEGORY_NAME_LENGTH} characters.`);
  }
  const existing = findCategory(store, treatment, trimmed);
  if (existing !== undefined) {
    return err(`${TREATMENT_LABELS[treatment]} already has a category named ${existing.name}.`);
  }
  const withId = nextId(store, "cat");
  const category: Category = { id: withId.id, treatment, name: trimmed, created_at: now };
  const withHistory = nextId(withId.store, "hist");
  return ok({
    store: {
      ...withHistory.store,
      categories: [...withHistory.store.categories, category],
      history: [
        ...withHistory.store.history,
        { id: withHistory.id, at: now, kind: "category_created", subject_type: "category", subject_id: category.id, before: null, after: category },
      ],
    },
    category,
  });
}
