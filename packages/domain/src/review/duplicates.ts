import { findEntry, reviseEntry } from "../entries/entries.ts";
import { err, ok, type Result } from "../result.ts";
import type { Entry, Store, Timestamp } from "../store/schema.ts";
import { linkFor } from "./goal-links.ts";

/**
 * Financial duplicate decisions (Financial Model §10.2, PRD §4.1). These are separate from
 * source reuse: they never merge entries, and every decision can be reversed.
 */
export type DuplicateDecision = {
  readonly entry_id: string;
  readonly action: "keep_both" | "exclude";
  /** The retained entry. Defaults to the entry the candidate already refers to. */
  readonly of_entry_id?: string;
};

/**
 * Duplicate references must name another existing entry, and an excluded duplicate's retained
 * entry must not itself be excluded; otherwise the chain would leave no retained entry.
 */
export function duplicateProblems(entries: readonly Entry[]): string[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const problems: string[] = [];
  for (const entry of entries) {
    const duplicate = entry.duplicate;
    if (duplicate === undefined) continue;
    const retained = byId.get(duplicate.of_entry_id);
    if (duplicate.of_entry_id === entry.id) {
      problems.push(`${entry.id} cannot be a duplicate of itself.`);
    } else if (retained === undefined) {
      problems.push(`${entry.id} refers to unknown entry ${duplicate.of_entry_id}.`);
    } else if (duplicate.status === "excluded" && retained.duplicate?.status === "excluded") {
      problems.push(
        `${entry.id} is excluded as a duplicate of ${retained.id}, which is itself excluded as a duplicate of ${retained.duplicate.of_entry_id}; no retained entry would remain.`,
      );
    }
  }
  return problems;
}

/**
 * Apply keep-both or exclude decisions together. Excluding confirms that the entry is a duplicate,
 * so it becomes reviewed and contributes zero; keeping both leaves the review state unchanged.
 * Either all decisions apply or none do.
 */
export function applyDuplicateDecisions(
  store: Store,
  decisions: readonly DuplicateDecision[],
  now: Timestamp,
): Result<{ readonly store: Store; readonly entries: readonly Entry[] }, string[]> {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const decision of decisions) {
    const entry = findEntry(store, decision.entry_id);
    if (seen.has(decision.entry_id)) problems.push(`${decision.entry_id} has more than one decision.`);
    seen.add(decision.entry_id);
    if (entry === undefined) {
      problems.push(`No entry ${decision.entry_id}.`);
      continue;
    }
    const target = decision.of_entry_id ?? entry.duplicate?.of_entry_id;
    if (decision.action === "keep_both") {
      if (entry.duplicate?.status !== "candidate") problems.push(`${entry.id} is not a duplicate candidate.`);
      else if (decision.of_entry_id !== undefined && decision.of_entry_id !== entry.duplicate.of_entry_id) {
        problems.push(`${entry.id} is a candidate of ${entry.duplicate.of_entry_id}, not ${decision.of_entry_id}.`);
      }
    } else if (entry.duplicate?.status === "excluded") {
      problems.push(`${entry.id} is already excluded as a duplicate of ${entry.duplicate.of_entry_id}.`);
    } else if (target === undefined) {
      problems.push(`Choose the retained entry that ${entry.id} duplicates.`);
    } else if (target === entry.id) {
      problems.push(`${entry.id} cannot be a duplicate of itself.`);
    } else if (findEntry(store, target) === undefined) {
      problems.push(`No entry ${target}.`);
    } else if (linkFor(store, entry.id) !== undefined) {
      problems.push(`${entry.id} is linked to the Savings goal; change its type before excluding it.`);
    }
  }
  if (problems.length > 0) return err(problems);

  let next = store;
  const changed: Entry[] = [];
  for (const decision of decisions) {
    const entry = findEntry(next, decision.entry_id) as Entry;
    const of_entry_id = (decision.of_entry_id ?? entry.duplicate?.of_entry_id) as string;
    const result =
      decision.action === "exclude"
        ? reviseEntry(next, entry.id, (current) => ({ ...current, duplicate: { status: "excluded", of_entry_id }, review_state: "reviewed" }), {
            kind: "duplicate_excluded",
            now,
          })
        : reviseEntry(next, entry.id, (current) => ({ ...current, duplicate: { status: "kept", of_entry_id } }), { kind: "duplicate_kept", now });
    next = result.store;
    changed.push(result.entry);
  }
  const after = duplicateProblems(next.entries);
  return after.length > 0 ? err(after) : ok({ store: next, entries: changed });
}

/**
 * Reverse keep-both or exclude decisions. The entry becomes a candidate again and unreviewed,
 * so it returns to the unreviewed figures until a new decision (PRD §4.4).
 */
export function restoreDuplicates(
  store: Store,
  entryIds: readonly string[],
  now: Timestamp,
): Result<{ readonly store: Store; readonly entries: readonly Entry[] }, string[]> {
  const problems: string[] = [];
  for (const id of entryIds) {
    const entry = findEntry(store, id);
    if (entry === undefined) problems.push(`No entry ${id}.`);
    else if (entry.duplicate === undefined || entry.duplicate.status === "candidate") problems.push(`${id} has no duplicate decision to reverse.`);
  }
  if (problems.length > 0) return err(problems);
  let next = store;
  const changed: Entry[] = [];
  for (const id of entryIds) {
    const result = reviseEntry(
      next,
      id,
      (current) => ({ ...current, duplicate: { status: "candidate", of_entry_id: (current.duplicate as { of_entry_id: string }).of_entry_id }, review_state: "unreviewed" }),
      { kind: "duplicate_restored", now },
    );
    next = result.store;
    changed.push(result.entry);
  }
  return ok({ store: next, entries: changed });
}
