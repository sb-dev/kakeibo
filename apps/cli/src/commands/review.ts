import {
  currentDate,
  isDuplicateCandidate,
  isExcludedDuplicate,
  parseIsoDate,
  parseWeekStart,
  reviewStatus,
  weekEntries,
  weekStartOf,
  type IsoDate,
} from "@kakeibo/domain";
import type { CommandContext } from "../context.ts";
import { NotInteractiveError, UsageError, afterSavedActions } from "../errors.ts";
import type { Choice } from "../prompts/prompter.ts";
import { addCategoryFlow, classifyFlow, closeFlow, confirmFlow, duplicatesFlow, reflectionFlow, restoreFlow } from "../review/actions.ts";
import { describeEntry, renderWeek } from "../review/render.ts";
import { loadStore } from "../storage/store-file.ts";

export type ReviewOptions = {
  readonly week?: string;
  readonly show?: boolean;
};

/** The explicit Monday, or the current local Monday–Sunday week (PRD §3). */
export function resolveWeek(flag: string | undefined, now: Date): IsoDate {
  if (flag === undefined) return weekStartOf(currentDate(now));
  const parsed = parseWeekStart(flag);
  if (parsed.ok) return parsed.value;
  if (parsed.error.code === "not_monday") {
    const date = parseIsoDate(flag);
    const monday = date.ok ? weekStartOf(date.value) : undefined;
    throw new UsageError(`--week must be a Monday; ${flag.trim()} is not. Weeks run Monday to Sunday${monday === undefined ? "" : `, so use --week ${monday}`}.`);
  }
  throw new UsageError(`Invalid --week '${flag}'. Use the Monday that starts the week, in YYYY-MM-DD form, for example 2026-10-19.`);
}

const EXIT = "exit";

/**
 * Open or resume the weekly review (PRD §4.4). `--show` prints the report without prompts.
 * Interactively, every confirmed action is saved at once; exiting never closes the review.
 */
export async function runReview(context: CommandContext, options: ReviewOptions): Promise<void> {
  const now = context.now();
  const weekStart = resolveWeek(options.week, now);
  const today = currentDate(now);

  if (options.show === true) {
    context.out(renderWeek(await loadStore(context.paths), weekStart, today));
    return;
  }
  if (!context.interactive) {
    throw new NotInteractiveError("review", `Use \`kakeibo review --week ${weekStart} --show\` to display the week without prompts.`);
  }

  let store = await loadStore(context.paths);
  context.out(renderWeek(store, weekStart, today));
  // Each confirmed action is saved at once; a later error must say so.
  let saved = 0;
  try {
    for (;;) {
      const entries = weekEntries(store, weekStart);
      const counted = entries.filter((entry) => !isExcludedDuplicate(entry));
      const candidates = entries.filter(isDuplicateCandidate).length;
      const decided = entries.filter((entry) => entry.duplicate !== undefined && entry.duplicate.status !== "candidate").length;
      const closed = reviewStatus(store, weekStart).state !== "not_closed";
      const choices: Choice[] = [];
      if (counted.some((entry) => entry.review_state === "unreviewed")) choices.push({ value: "confirm", name: "Confirm entries as reviewed" });
      if (counted.length > 0) choices.push({ value: "classify", name: "Classify or correct an entry" });
      if (candidates > 0) choices.push({ value: "duplicates", name: `Resolve duplicate candidates (${candidates})` });
      if (decided > 0) choices.push({ value: "restore", name: "Reverse a duplicate decision" });
      choices.push(
        { value: "category", name: "Add a category" },
        { value: "reflect", name: "Write the reflection" },
        { value: "close", name: closed ? "Close the review again" : "Close the review" },
        { value: "show", name: "Show the full week again" },
        { value: EXIT, name: "Exit (exiting does not close the review)" },
      );

      const action = await context.prompter.select(`Review ${weekStart}: what next?`, choices, EXIT);
      switch (action) {
        case "confirm":
          if (await confirmFlow(context, store, entries)) saved += 1;
          break;
        case "classify": {
          const id = await context.prompter.select(
            "Which entry?",
            counted.map((entry) => ({ value: entry.id, name: describeEntry(store, entry) })),
          );
          const entry = counted.find((candidate) => candidate.id === id);
          if (entry !== undefined && (await classifyFlow(context, store, entry))) saved += 1;
          break;
        }
        case "duplicates":
          if (await duplicatesFlow(context, store, entries)) saved += 1;
          break;
        case "restore":
          if (await restoreFlow(context, store, entries)) saved += 1;
          break;
        case "category":
          if (await addCategoryFlow(context, store)) saved += 1;
          break;
        case "reflect":
          if (await reflectionFlow(context, store, weekStart)) saved += 1;
          break;
        case "close":
          if (await closeFlow(context, store, weekStart)) saved += 1;
          break;
        case "show":
          context.out(renderWeek(store, weekStart, today));
          break;
        default:
          context.out(closed ? "Exited." : "Exited. The review is not closed; run the same command to resume.");
          return;
      }
      store = await loadStore(context.paths);
    }
  } catch (error) {
    throw afterSavedActions(error, saved);
  }
}
