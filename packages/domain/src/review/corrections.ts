import { classificationProblems, type Classification } from "../classification/rules.ts";
import { findEntry, reviseEntry } from "../entries/entries.ts";
import { err, ok, type Result } from "../result.ts";
import { savingsGoal } from "../store/create.ts";
import { nextId } from "../store/ids.ts";
import type { Entry, GoalContributionLink, Store, Timestamp } from "../store/schema.ts";
import { goalLinkProblems } from "./goal-links.ts";
import { isDuplicateCandidate, isExcludedDuplicate } from "./totals.ts";

/**
 * One confirmed correction (PRD §4.4). Every listed entry receives its new classification and the
 * chosen review state together. A reviewed entry stays reviewed only with fresh confirmation.
 */
export type EntryCorrection = {
  readonly entries: readonly { readonly id: string; readonly classification: Classification }[];
  /** Remove this Savings-goal link first. */
  readonly unlink?: string;
  /** Link these entries to the Savings goal; joins a one-sided link that already holds one of them. */
  readonly link?: readonly string[];
  readonly review: "reviewed" | "unreviewed";
  /** Required to confirm an entry that stays Unclassified / Uncategorised. */
  readonly accept_unclassified?: boolean;
};

function sameClassification(entry: Entry, classification: Classification): boolean {
  return (
    entry.movement === classification.movement &&
    entry.purpose === classification.purpose &&
    entry.treatment === classification.treatment &&
    entry.category_id === classification.category_id
  );
}

function addLinkHistory(store: Store, kind: "goal_link_added" | "goal_link_removed", before: GoalContributionLink | null, after: GoalContributionLink | null, now: Timestamp): Store {
  const withId = nextId(store, "hist");
  const subject = (after ?? before) as GoalContributionLink;
  return {
    ...withId.store,
    history: [...withId.store.history, { id: withId.id, at: now, kind, subject_type: "goal_link", subject_id: subject.id, before, after }],
  };
}

function link(store: Store, entryIds: readonly string[], now: Timestamp): Store {
  const existing = store.goal_contribution_links.filter((candidate) => candidate.entry_ids.some((id) => entryIds.includes(id)));
  const first = existing[0];
  if (first === undefined) {
    const withId = nextId(store, "link");
    const created: GoalContributionLink = { id: withId.id, goal_id: savingsGoal(store).id, entry_ids: [...entryIds], linked_at: now };
    return addLinkHistory({ ...withId.store, goal_contribution_links: [...withId.store.goal_contribution_links, created] }, "goal_link_added", null, created, now);
  }
  // Joining the other account side of a transfer to its existing link keeps one contribution.
  // Merging two links is left to goalLinkProblems, which rejects a link with more than two entries.
  const entry_ids = [...new Set([...existing.flatMap((candidate) => candidate.entry_ids), ...entryIds])];
  if (existing.length === 1 && entry_ids.length === first.entry_ids.length) return store;
  const joined: GoalContributionLink = { ...first, entry_ids };
  const links = store.goal_contribution_links.flatMap((candidate) => (candidate === first ? [joined] : existing.includes(candidate) ? [] : [candidate]));
  return addLinkHistory({ ...store, goal_contribution_links: links }, "goal_link_added", first, joined, now);
}

/**
 * Apply a classification correction, with any Savings-goal link change, as one action.
 * Returns plain-words problems and leaves the store unchanged when any rule fails.
 */
export function applyEntryCorrection(
  store: Store,
  correction: EntryCorrection,
  now: Timestamp,
): Result<{ readonly store: Store; readonly entries: readonly Entry[] }, string[]> {
  const problems: string[] = [];
  for (const { id, classification } of correction.entries) {
    const entry = findEntry(store, id);
    if (entry === undefined) {
      problems.push(`No entry ${id}.`);
      continue;
    }
    if (isExcludedDuplicate(entry)) problems.push(`${id} is an excluded duplicate; restore it before changing its classification.`);
    if (correction.review === "reviewed" && isDuplicateCandidate(entry)) {
      problems.push(`${id} is an unresolved duplicate candidate; keep both or exclude it before confirming.`);
    }
    if (correction.review === "reviewed" && classification.treatment === "unclassified" && correction.accept_unclassified !== true) {
      problems.push(`${id} stays Unclassified / Uncategorised; confirming it needs explicit acceptance.`);
    }
    for (const problem of classificationProblems(store, classification, entry.source.source_movement)) problems.push(`${id}: ${problem}.`);
  }
  if (correction.unlink !== undefined && !store.goal_contribution_links.some((candidate) => candidate.id === correction.unlink)) {
    problems.push(`No Savings-goal link ${correction.unlink}.`);
  }
  if (problems.length > 0) return err(problems);

  let next = store;
  if (correction.unlink !== undefined) {
    const removed = next.goal_contribution_links.find((candidate) => candidate.id === correction.unlink) as GoalContributionLink;
    next = addLinkHistory({ ...next, goal_contribution_links: next.goal_contribution_links.filter((candidate) => candidate !== removed) }, "goal_link_removed", removed, null, now);
  }
  if (correction.link !== undefined && correction.link.length > 0) next = link(next, correction.link, now);

  const changed: Entry[] = [];
  for (const { id, classification } of correction.entries) {
    const entry = findEntry(next, id) as Entry;
    if (sameClassification(entry, classification) && entry.review_state === correction.review) continue;
    const result = reviseEntry(next, id, (current) => ({ ...current, ...classification, review_state: correction.review }), { kind: "entry_classified", now });
    next = result.store;
    changed.push(result.entry);
  }
  const linkProblems = goalLinkProblems(next);
  return linkProblems.length > 0 ? err(linkProblems) : ok({ store: next, entries: changed });
}

/**
 * Explicit confirmation of unreviewed entries (Financial Model §7.1). Unclassified entries need
 * explicit acceptance; duplicate candidates and excluded duplicates cannot be confirmed here.
 */
export function confirmEntries(
  store: Store,
  entryIds: readonly string[],
  options: { readonly acceptUnclassified: boolean },
  now: Timestamp,
): Result<{ readonly store: Store; readonly entries: readonly Entry[] }, string[]> {
  const problems: string[] = [];
  for (const id of entryIds) {
    const entry = findEntry(store, id);
    if (entry === undefined) problems.push(`No entry ${id}.`);
    else if (entry.review_state === "reviewed") problems.push(`${id} is already reviewed.`);
    else if (isDuplicateCandidate(entry)) problems.push(`${id} is an unresolved duplicate candidate of ${entry.duplicate?.of_entry_id}; keep both or exclude it first.`);
    else if (entry.treatment === "unclassified" && !options.acceptUnclassified) {
      problems.push(`${id} is Unclassified / Uncategorised; confirming it needs explicit acceptance.`);
    }
  }
  if (problems.length > 0) return err(problems);
  let next = store;
  const changed: Entry[] = [];
  for (const id of entryIds) {
    const result = reviseEntry(next, id, (current) => ({ ...current, review_state: "reviewed" }), {
      kind: "entry_confirmed",
      now,
      ...(entryIds.length > 1 ? { note: `Bulk confirmation of ${entryIds.length} entries` } : {}),
    });
    next = result.store;
    changed.push(result.entry);
  }
  return ok({ store: next, entries: changed });
}
