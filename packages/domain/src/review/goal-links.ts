import type { Entry, GoalContributionLink, Store } from "../store/schema.ts";

/** The Savings-goal link that contains an entry, if any. */
export function linkFor(store: Store, entryId: string): GoalContributionLink | undefined {
  return store.goal_contribution_links.find((link) => link.entry_ids.includes(entryId));
}

/**
 * Rules for explicit Savings-goal contribution links (Financial Model §6.3, PRD §4.3):
 * an entry is a goal contribution exactly when it is in one link; a link holds one entry or
 * both account sides of one transfer (different accounts, opposite directions, equal amounts).
 */
export function goalLinkProblems(store: Store): string[] {
  const problems: string[] = [];
  const byId = new Map(store.entries.map((entry) => [entry.id, entry]));
  const linkedTo = new Map<string, string>();
  for (const link of store.goal_contribution_links) {
    if (!store.goals.some((goal) => goal.id === link.goal_id)) problems.push(`${link.id} refers to unknown goal ${link.goal_id}.`);
    if (link.entry_ids.length < 1 || link.entry_ids.length > 2) problems.push(`${link.id} must link one entry or both sides of one transfer.`);
    const entries: Entry[] = [];
    for (const id of link.entry_ids) {
      const entry = byId.get(id);
      if (entry === undefined) {
        problems.push(`${link.id} refers to unknown entry ${id}.`);
        continue;
      }
      const other = linkedTo.get(id);
      if (other !== undefined) problems.push(`${id} is linked by both ${other} and ${link.id}.`);
      linkedTo.set(id, link.id);
      if (entry.purpose !== "goal_contribution") problems.push(`${id} is linked by ${link.id} but is not a goal contribution.`);
      if (entry.duplicate?.status === "excluded") problems.push(`${id} is an excluded duplicate and cannot contribute to the goal.`);
      entries.push(entry);
    }
    const [a, b] = entries;
    if (a !== undefined && b !== undefined) {
      if (a.account_id === b.account_id) problems.push(`${link.id} links two entries in the same account.`);
      if (a.source.source_movement === b.source.source_movement) problems.push(`${link.id} links two entries in the same direction.`);
      if (a.source.amount !== b.source.amount) problems.push(`${link.id} links entries with different amounts.`);
    }
  }
  for (const entry of store.entries) {
    if (entry.purpose === "goal_contribution" && !linkedTo.has(entry.id)) problems.push(`${entry.id} is a goal contribution without a Savings-goal link.`);
  }
  return problems;
}
