import { entryRevision } from "../entries/entries.ts";
import { weekEndOf, type IsoDate } from "../periods/periods.ts";
import { nextId } from "../store/ids.ts";
import type { Entry, ReviewClosure, ReviewReflection, Store, Timestamp, WeeklyReview } from "../store/schema.ts";
import { entriesInRange } from "./totals.ts";

/** Every entry posted in the Monday–Sunday week, including excluded duplicates. */
export function weekEntries(store: Store, weekStart: IsoDate): Entry[] {
  return entriesInRange(store, weekStart, weekEndOf(weekStart));
}

export function findReview(store: Store, weekStart: IsoDate): WeeklyReview | undefined {
  return store.reviews.find((review) => review.week_start === weekStart);
}

export type ReviewStatus =
  | { readonly state: "not_closed" }
  | { readonly state: "closed"; readonly closure: ReviewClosure }
  | {
      readonly state: "changed_since_review";
      readonly closure: ReviewClosure;
      /** Entries in the week now that were not at closure (new imports, reversals, moved dates). */
      readonly added: readonly string[];
      /** Entries at closure that are no longer in the week. */
      readonly removed: readonly string[];
      /** Entries changed since closure. */
      readonly revised: readonly string[];
    };

/**
 * Compare the week's current entries and revisions with the latest closure (PRD §4.4).
 * A closed week whose membership or entry revisions changed is "changed since review".
 */
export function reviewStatus(store: Store, weekStart: IsoDate): ReviewStatus {
  const closure = findReview(store, weekStart)?.closures.at(-1);
  if (closure === undefined) return { state: "not_closed" };
  const current = new Map(weekEntries(store, weekStart).map((entry) => [entry.id, entryRevision(entry)]));
  const closed = new Map(closure.entries.map((entry) => [entry.entry_id, entry.revision]));
  const added = [...current.keys()].filter((id) => !closed.has(id));
  const removed = [...closed.keys()].filter((id) => !current.has(id));
  const revised = [...current].filter(([id, revision]) => closed.has(id) && closed.get(id) !== revision).map(([id]) => id);
  if (added.length + removed.length + revised.length === 0) return { state: "closed", closure };
  return { state: "changed_since_review", closure, added, removed, revised };
}

function upsertReview(store: Store, weekStart: IsoDate, now: Timestamp, change: (review: WeeklyReview) => WeeklyReview): { readonly store: Store; readonly before: WeeklyReview | null; readonly review: WeeklyReview } {
  const existing = findReview(store, weekStart);
  if (existing !== undefined) {
    const review = change(existing);
    return { store: { ...store, reviews: store.reviews.map((candidate) => (candidate === existing ? review : candidate)) }, before: existing, review };
  }
  const withId = nextId(store, "rev");
  const review = change({ id: withId.id, week_start: weekStart, closures: [], created_at: now });
  return { store: { ...withId.store, reviews: [...withId.store.reviews, review] }, before: null, review };
}

function withHistory(store: Store, kind: "review_reflection_saved" | "review_closed", subjectId: string, before: unknown, after: unknown, now: Timestamp): Store {
  const withId = nextId(store, "hist");
  return { ...withId.store, history: [...withId.store.history, { id: withId.id, at: now, kind, subject_type: "review", subject_id: subjectId, before, after }] };
}

function clean(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

/** Save the two optional reflection fields. Empty answers clear a field. Closure is unaffected. */
export function saveReflection(store: Store, weekStart: IsoDate, reflection: ReviewReflection, now: Timestamp): { readonly store: Store; readonly review: WeeklyReview } {
  const stood_out = clean(reflection.stood_out);
  const next_change = clean(reflection.next_change);
  const cleaned: ReviewReflection = { ...(stood_out === undefined ? {} : { stood_out }), ...(next_change === undefined ? {} : { next_change }) };
  const result = upsertReview(store, weekStart, now, (review) => {
    const { reflection: _previous, ...rest } = review;
    return stood_out === undefined && next_change === undefined ? rest : { ...rest, reflection: cleaned };
  });
  return {
    store: withHistory(result.store, "review_reflection_saved", result.review.id, result.before?.reflection ?? null, result.review.reflection ?? null, now),
    review: result.review,
  };
}

/**
 * Close the week. The closure records every entry in the week and its revision; unresolved
 * entries stay unreviewed (Financial Model §12). Earlier closures and notes are kept.
 */
export function closeReview(store: Store, weekStart: IsoDate, now: Timestamp): { readonly store: Store; readonly review: WeeklyReview; readonly closure: ReviewClosure } {
  const closure: ReviewClosure = {
    closed_at: now,
    entries: weekEntries(store, weekStart).map((entry) => ({ entry_id: entry.id, revision: entryRevision(entry) })),
  };
  const result = upsertReview(store, weekStart, now, (review) => ({ ...review, closures: [...review.closures, closure] }));
  return {
    store: withHistory(result.store, "review_closed", result.review.id, result.before?.closures.at(-1) ?? null, closure, now),
    review: result.review,
    closure,
  };
}
