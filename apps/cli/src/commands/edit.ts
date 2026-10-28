import { findEntry, isDuplicateCandidate } from "@kakeibo/domain";
import type { CommandContext } from "../context.ts";
import { CliError, NotInteractiveError } from "../errors.ts";
import type { Choice } from "../prompts/prompter.ts";
import { classifyFlow, confirmFlow, duplicateEntryFlow, reusedSources, reverseReuseFlow } from "../review/actions.ts";
import { renderEntryDetail } from "../review/render.ts";
import { loadStore } from "../storage/store-file.ts";

const DONE = "done";

/**
 * Correct one displayed entry (PRD §3): its type and classification, review state, duplicate
 * decision or an incorrect source-reuse decision. Shows the entry's source observations first.
 */
export async function runEdit(context: CommandContext, entryId: string): Promise<void> {
  const id = entryId.trim().toLowerCase();
  if (!context.interactive) {
    throw new NotInteractiveError("edit", "Use `kakeibo review --week <monday> --show` to see entries without prompts.");
  }
  let store = await loadStore(context.paths);
  for (;;) {
    const entry = findEntry(store, id);
    if (entry === undefined) {
      throw new CliError(`No entry ${id}. Entry IDs appear in \`kakeibo review --show\`.`);
    }
    context.out(renderEntryDetail(store, entry));
    const choices: Choice[] = [{ value: "classify", name: "Change type, treatment or category" }];
    if (entry.review_state === "unreviewed" && !isDuplicateCandidate(entry)) choices.push({ value: "confirm", name: "Confirm as reviewed" });
    choices.push({ value: "duplicate", name: entry.duplicate === undefined || entry.duplicate.status === "candidate" ? "Duplicate decision" : "Reverse the duplicate decision" });
    if (reusedSources(store, entry).length > 0) choices.push({ value: "reverse", name: "Reverse an incorrect source reuse" });
    choices.push({ value: DONE, name: "Done" });

    const action = await context.prompter.select(`Edit ${entry.id}: what next?`, choices, DONE);
    switch (action) {
      case "classify":
        await classifyFlow(context, store, entry);
        break;
      case "confirm":
        await confirmFlow(context, store, [entry]);
        break;
      case "duplicate":
        await duplicateEntryFlow(context, store, entry);
        break;
      case "reverse":
        await reverseReuseFlow(context, store, entry);
        break;
      default:
        return;
    }
    store = await loadStore(context.paths);
  }
}
