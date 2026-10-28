import { TREATMENT_LABELS, currentDate, findCategory, weekEndOf, type Treatment } from "@kakeibo/domain";
import type { CommandContext } from "../context.ts";
import { UsageError } from "../errors.ts";
import { SPENDING_TREATMENTS, monthPeriod, renderSpending, type ReportPeriod } from "../reports/render.ts";
import { loadStore } from "../storage/store-file.ts";
import { resolveMonth } from "./plan.ts";
import { resolveWeek } from "./review.ts";

export type SpendingOptions = {
  readonly month?: string;
  readonly week?: string;
  readonly envelope?: string;
  readonly category?: string;
};

function key(text: string): string {
  return text.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

/** A spending treatment by its label, ignoring case: "Needs", "outside plan", "outside_plan". */
export function parseEnvelope(text: string): Treatment {
  const wanted = key(text);
  const found = SPENDING_TREATMENTS.find((treatment) => key(TREATMENT_LABELS[treatment]) === wanted);
  if (found !== undefined) return found;
  if (wanted === "goal") {
    throw new UsageError("Goal contributions are not spending. Run `kakeibo summary` to see Savings-goal contributions.");
  }
  throw new UsageError(`Unknown --envelope '${text}'. Use one of: ${SPENDING_TREATMENTS.map((treatment) => TREATMENT_LABELS[treatment]).join(", ")}.`);
}

/**
 * Spending for a month or week (PRD §3): treatment totals, then one envelope's categories, then one
 * category's entries. Read-only and without prompts, so it works when output is redirected.
 */
export async function runSpending(context: CommandContext, options: SpendingOptions): Promise<void> {
  if (options.month !== undefined && options.week !== undefined) {
    throw new UsageError("Use either --month or --week, not both.");
  }
  if (options.category !== undefined && options.envelope === undefined) {
    throw new UsageError("--category needs --envelope, for example --envelope Needs --category Groceries.");
  }
  const now = context.now();
  let period: ReportPeriod;
  if (options.week !== undefined) {
    const weekStart = resolveWeek(options.week, now);
    period = { kind: "week", from: weekStart, to: weekEndOf(weekStart) };
  } else {
    period = monthPeriod(resolveMonth(options.month, now));
  }
  const treatment = options.envelope === undefined ? undefined : parseEnvelope(options.envelope);

  const store = await loadStore(context.paths);
  let categoryId: string | undefined;
  if (treatment !== undefined && options.category !== undefined) {
    const category = findCategory(store, treatment, options.category);
    if (category === undefined) {
      const names = store.categories.filter((candidate) => candidate.treatment === treatment).map((candidate) => candidate.name);
      throw new UsageError(`${TREATMENT_LABELS[treatment]} has no category '${options.category.trim()}'. Its categories: ${names.join(", ")}.`);
    }
    categoryId = category.id;
  }
  context.out(renderSpending(store, period, currentDate(now), treatment, categoryId));
}
