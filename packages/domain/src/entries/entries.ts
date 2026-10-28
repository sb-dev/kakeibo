import { nextId } from "../store/ids.ts";
import type { Entry, HistoryKind, HistoryRecord, SourceValues, Store, Timestamp } from "../store/schema.ts";

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
    revision: 1,
    created_at: now,
  };
  return { store: { ...withId.store, entries: [...withId.store.entries, entry] }, entry };
}

/** The entry's revision; entries saved before revisions were recorded are revision 1. */
export function entryRevision(entry: Entry): number {
  return entry.revision ?? 1;
}

export function findEntry(store: Store, entryId: string): Entry | undefined {
  return store.entries.find((entry) => entry.id === entryId);
}

/**
 * Apply one explicit change to an entry: bump its revision and record the full entry before and
 * after in history (PRD §4.4). Closed reviews compare revisions to detect later changes.
 */
export function reviseEntry(
  store: Store,
  entryId: string,
  change: (entry: Entry) => Entry,
  meta: { readonly kind: HistoryKind; readonly now: Timestamp; readonly note?: string },
): { readonly store: Store; readonly entry: Entry; readonly history: HistoryRecord } {
  const before = findEntry(store, entryId);
  if (before === undefined) {
    throw new Error(`No entry ${entryId}`);
  }
  const after: Entry = { ...change(before), id: before.id, revision: entryRevision(before) + 1 };
  const withId = nextId(store, "hist");
  const history: HistoryRecord = {
    id: withId.id,
    at: meta.now,
    kind: meta.kind,
    subject_type: "entry",
    subject_id: entryId,
    before,
    after,
    ...(meta.note === undefined ? {} : { note: meta.note }),
  };
  return {
    store: {
      ...withId.store,
      entries: withId.store.entries.map((entry) => (entry.id === entryId ? after : entry)),
      history: [...withId.store.history, history],
    },
    entry: after,
    history,
  };
}
