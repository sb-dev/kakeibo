import { currentDate } from "@kakeibo/domain";
import type { CommandContext } from "../context.ts";
import { renderSummary } from "../reports/render.ts";
import { loadStore } from "../storage/store-file.ts";
import { resolveMonth } from "./plan.ts";

export type SummaryOptions = {
  readonly month?: string;
};

/** The monthly summary (PRD §4.5). Read-only and without prompts, so it works when output is redirected. */
export async function runSummary(context: CommandContext, options: SummaryOptions): Promise<void> {
  const now = context.now();
  const month = resolveMonth(options.month, now);
  context.out(renderSummary(await loadStore(context.paths), month, currentDate(now)));
}
