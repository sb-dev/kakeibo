import { nextId } from "../store/ids.ts";
import type { Entry, SourceValues, Store, Timestamp } from "../store/schema.ts";

/** The category every unresolved entry starts in (PRD §4.3: `Unclassified / Uncategorised`). */
export function uncategorisedCategoryId(store: Store): string {
  const category = store.categories.find((candidate) => candidate.treatment === "unclassified");
  if (category === undefined) {
    throw new Error("The store has no Unclassified category");
  }
  return category.id;
}

/**
 * A new imported entry. Movement comes from the confirmed source mapping (PRD §4.6); purpose is the
 * initial interpretation of that movement. Treatment and category stay unresolved and the entry is
 * unreviewed: only explicit confirmation creates reviewed truth (Financial Model §7.1).
 */
export function createImportedEntry(
  store: Store,
  accountId: string,
  values: SourceValues,
  now: Timestamp,
): { readonly store: Store; readonly entry: Entry } {
  const withId = nextId(store, "tx");
  const entry: Entry = {
    id: withId.id,
    account_id: accountId,
    source: values,
    movement: values.source_movement,
    purpose: values.source_movement === "outflow" ? "spending" : "income",
    treatment: "unclassified",
    category_id: uncategorisedCategoryId(store),
    review_state: "unreviewed",
    created_at: now,
  };
  return { store: { ...withId.store, entries: [...withId.store.entries, entry] }, entry };
}
