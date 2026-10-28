import {
  ENVELOPES,
  TREATMENT_LABELS,
  addPence,
  categorySpendingTotals,
  currentPlanRevision,
  flexibleBudget,
  formatPence,
  goalAllocationTotal,
  isExcludedDuplicate,
  monthEndOf,
  monthSegments,
  monthStartOf,
  negatePence,
  periodSummary,
  reviewedRemaining,
  spendingEntries,
  splitTotal,
  sumPence,
  type Entry,
  type IsoDate,
  type Month,
  type Pence,
  type PeriodSummary,
  type ReviewSplit,
  type SpendingAmounts,
  type Store,
  type Treatment,
} from "@kakeibo/domain";
import { renderGrid, renderTable } from "../format/table.ts";
import { categoryName, classificationLabel, entryNote, monthToDate, typeLabel } from "../review/render.ts";

/** Treatments that can hold spending, in report order. Goal contributions are never spending. */
export const SPENDING_TREATMENTS: readonly Treatment[] = ["fixed", ...ENVELOPES, "outside_plan", "unclassified"];

export type ReportPeriod =
  | { readonly kind: "month"; readonly month: Month; readonly from: IsoDate; readonly to: IsoDate }
  | { readonly kind: "week"; readonly from: IsoDate; readonly to: IsoDate };

export function monthPeriod(month: Month): ReportPeriod {
  return { kind: "month", month, from: monthStartOf(month), to: monthEndOf(month) };
}

const CAVEAT = "Totals describe imported activity only. They are not a bank balance, verified savings or proof that every account is complete.";

function periodName(period: ReportPeriod): string {
  return period.kind === "month" ? `${period.month} (${period.from} to ${period.to})` : `week ${period.from} to ${period.to}`;
}

function progress(period: ReportPeriod, today: IsoDate): string {
  return period.from <= today && today <= period.to ? " (in progress)" : "";
}

/** The `--month` or `--week` flag that selects the period again, for drill-down hints. */
function periodFlag(period: ReportPeriod): string {
  return period.kind === "month" ? `--month ${period.month}` : `--week ${period.from}`;
}

const AMOUNT_HEADER = ["Gross", "Refunds", "Net", "Reviewed", "Unreviewed", "Entries"] as const;

function amountCells(split: ReviewSplit): string[] {
  const total = splitTotal(split);
  return [formatPence(total.gross), formatPence(total.refunds), formatPence(total.net), formatPence(split.reviewed.net), formatPence(split.unreviewed.net), String(total.count)];
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function countedTotal(contributions: PeriodSummary["contributions"], reviewed: boolean): string {
  const chosen = contributions.filter((contribution) => contribution.reviewed === reviewed);
  return `${formatPence(sumPence(chosen.map((contribution) => contribution.amount)))} (${chosen.length})`;
}

function amountOf(entries: readonly Entry[]): Pence {
  return sumPence(entries.map((entry) => entry.source.amount));
}

/** Categories of one treatment in the store's category order. */
function categoryRows(store: Store, entries: readonly Entry[], treatment: Treatment): { readonly categoryId: string; readonly split: ReviewSplit }[] {
  const totals = new Map(categorySpendingTotals(entries, treatment).map((category) => [category.category_id, category.split]));
  const order = store.categories.map((category) => category.id);
  return [...totals]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([categoryId, split]) => ({ categoryId, split }));
}

/**
 * The monthly summary (PRD §4.5): the plan beside observed income and spending, envelope use against
 * reviewed net spending, Fixed separately, category totals and unresolved counts. Plain text only.
 */
export function renderSummary(store: Store, month: Month, today: IsoDate): string {
  const period = monthPeriod(month);
  const summary = periodSummary(store, period.from, period.to);
  const plan = currentPlanRevision(store, month);
  const lines = [`Summary for ${periodName(period)}${progress(period, today)}`, CAVEAT, ""];

  if (plan === undefined) {
    lines.push(`No plan saved for ${month}. Run \`kakeibo plan --month ${month}\` to create one.`);
  } else {
    lines.push(
      `Plan (revision ${plan.revision})`,
      indent(
        renderTable([
          ["Planned income", formatPence(plan.planning_income)],
          ["Fixed commitments", formatPence(plan.fixed_commitments)],
          ["Savings allocation", formatPence(goalAllocationTotal(plan))],
          ["Flexible budget", formatPence(flexibleBudget(plan))],
        ]),
      ),
      `  Intention: ${plan.intention ?? "(none)"}`,
    );
  }

  // The plan's envelope limits stay visible beside zero imported spending.
  if (summary.entries.length === 0) lines.push("", `No imported activity in ${month}.`);

  const income = summary.income;
  const overall = splitTotal(summary.overall);
  const observed = (label: string, reviewed: Pence, unreviewed: Pence): string[] => [label, formatPence(reviewed), formatPence(unreviewed), formatPence(addPence(reviewed, unreviewed))];
  const amounts = (label: string, pick: (amounts: SpendingAmounts) => Pence): string[] => observed(label, pick(summary.overall.reviewed), pick(summary.overall.unreviewed));
  lines.push(
    "",
    "Observed (refunds reduce spending and are never income)",
    indent(
      renderGrid(
        ["", "Reviewed", "Unreviewed", "Total"],
        [
          observed("Income", income.reviewed, income.unreviewed),
          amounts("Gross spending", (split) => split.gross),
          amounts("Refunds", (split) => split.refunds),
          amounts("Net spending", (split) => split.net),
        ],
        [1, 2, 3],
      ),
    ),
    `  Income minus net spending: ${formatPence(summary.income_minus_net_spending)} (${formatPence(addPence(income.reviewed, income.unreviewed))} − ${formatPence(overall.net)})`,
    `  Not spending: transfers ${formatPence(summary.transfers.amount)} (${summary.transfers.count}) · excluded duplicates ${formatPence(amountOf(summary.excluded_duplicates))} (${summary.excluded_duplicates.length})`,
    `  Savings goal: planned allocation ${plan === undefined ? "no plan" : formatPence(goalAllocationTotal(plan))} · contributions, counted once per transfer: reviewed ${countedTotal(summary.contributions, true)} · unreviewed ${countedTotal(summary.contributions, false)}`,
  );

  const row = (label: string, limit: Pence | undefined, split: ReviewSplit): string[] => [
    label,
    limit === undefined ? (plan === undefined ? "no plan" : "—") : formatPence(limit),
    formatPence(split.reviewed.net),
    formatPence(split.unreviewed.net),
    limit === undefined ? "—" : formatPence(reviewedRemaining(limit, split)),
  ];
  const header = ["", "Limit", "Reviewed", "Unreviewed", "Reviewed remaining"];
  lines.push(
    "",
    "Envelopes (net spending)",
    indent(
      renderGrid(
        header,
        [
          ...ENVELOPES.map((envelope) => row(TREATMENT_LABELS[envelope], plan?.envelopes[envelope], summary.spending[envelope])),
          row("Flexible total", plan === undefined ? undefined : sumPence(ENVELOPES.map((envelope) => plan.envelopes[envelope])), summary.flexible),
        ],
        [1, 2, 3, 4],
      ),
    ),
    "",
    "Outside the envelopes (net spending)",
    indent(
      renderGrid(
        header,
        [
          row("Fixed", plan?.fixed_commitments, summary.spending.fixed),
          row("Outside plan", undefined, summary.spending.outside_plan),
          row("Unclassified", undefined, summary.spending.unclassified),
        ],
        [1, 2, 3, 4],
      ),
    ),
    "  Fixed is compared with the planned fixed commitments.",
  );

  const rows = SPENDING_TREATMENTS.flatMap((treatment) =>
    categoryRows(store, summary.entries, treatment).map(({ categoryId, split }) => [`${TREATMENT_LABELS[treatment]} / ${categoryName(store, categoryId)}`, ...amountCells(split)]),
  );
  lines.push("", "Spending by category");
  lines.push(rows.length === 0 ? "  No spending or refunds." : indent(renderGrid(["Treatment / category", ...AMOUNT_HEADER], rows, [1, 2, 3, 4, 5, 6])));

  lines.push(
    "",
    `Unresolved: ${summary.unreviewed_count} unreviewed · ${summary.unclassified_count} Unclassified · ${summary.duplicate_candidate_count} duplicate candidate${summary.duplicate_candidate_count === 1 ? "" : "s"}`,
    `Drill down: kakeibo spending --month ${month} --envelope <name> [--category <name>]`,
  );
  return lines.join("\n");
}

/** Limit and reviewed remaining for one treatment in each month the period touches, month to date. */
function limitLines(store: Store, period: ReportPeriod, treatment: Treatment, today: IsoDate): string[] {
  if (treatment !== "fixed" && !(ENVELOPES as readonly Treatment[]).includes(treatment)) {
    return [`${TREATMENT_LABELS[treatment]} has no plan limit.`];
  }
  const lines = ["Against the plan (month to date, each month against its own plan)"];
  for (const segment of monthSegments(period.from, period.to)) {
    const plan = currentPlanRevision(store, segment.month);
    const split = periodSummary(store, monthStartOf(segment.month), segment.to).spending[treatment];
    const range = `${segment.month} (${monthStartOf(segment.month)} to ${segment.to})${monthStartOf(segment.month) <= today && today <= segment.to ? " (in progress)" : ""}`;
    if (plan === undefined) {
      lines.push(`  ${range}: no plan saved. Run \`kakeibo plan --month ${segment.month}\` to create one.`);
      continue;
    }
    const limit = treatment === "fixed" ? plan.fixed_commitments : plan.envelopes[treatment as (typeof ENVELOPES)[number]];
    lines.push(
      `  ${range}: ${treatment === "fixed" ? "planned fixed commitments" : "limit"} ${formatPence(limit)} · reviewed ${formatPence(split.reviewed.net)} · unreviewed ${formatPence(split.unreviewed.net)} · reviewed remaining ${formatPence(reviewedRemaining(limit, split))}`,
    );
  }
  return lines;
}

function header(title: string, period: ReportPeriod, today: IsoDate): string[] {
  return [`${title} for ${periodName(period)}${progress(period, today)}`, CAVEAT];
}

/**
 * Spending for a month or week (PRD §§3, 4.5): treatment totals first, then one treatment's categories,
 * then one category's entries. Every level uses the same domain totals, so each reconciles with the
 * level above and with the monthly summary.
 */
export function renderSpending(store: Store, period: ReportPeriod, today: IsoDate, treatment?: Treatment, categoryId?: string): string {
  const summary = periodSummary(store, period.from, period.to);
  if (treatment === undefined) return renderTreatments(store, summary, period, today);
  if (categoryId === undefined) return renderCategories(store, summary, period, today, treatment);
  return renderEntries(store, summary, period, today, treatment, categoryId);
}

function noActivity(period: ReportPeriod): string {
  return `No imported activity in ${period.kind === "month" ? period.month : "this week"}.`;
}

function renderTreatments(store: Store, summary: PeriodSummary, period: ReportPeriod, today: IsoDate): string {
  const lines = header("Spending", period, today);
  if (summary.entries.length === 0) {
    lines.push("", noActivity(period));
  } else {
    lines.push(
      "",
      "Net spending by treatment (refunds reduce spending and are never income)",
      indent(
        renderGrid(
          ["Treatment", ...AMOUNT_HEADER],
          [...SPENDING_TREATMENTS.map((treatment) => [TREATMENT_LABELS[treatment], ...amountCells(summary.spending[treatment])]), ["Total", ...amountCells(summary.overall)]],
          [1, 2, 3, 4, 5, 6],
        ),
      ),
      `  Not spending: transfers ${formatPence(summary.transfers.amount)} (${summary.transfers.count}) · Savings-goal contributions, counted once per transfer: reviewed ${countedTotal(summary.contributions, true)} · unreviewed ${countedTotal(summary.contributions, false)} · excluded duplicates ${summary.excluded_duplicates.length}`,
    );
  }
  lines.push("", ...monthToDate(store, period.from, period.to, today));
  lines.push("", `Drill down: kakeibo spending ${periodFlag(period)} --envelope <name>`);
  return lines.join("\n");
}

function renderCategories(store: Store, summary: PeriodSummary, period: ReportPeriod, today: IsoDate, treatment: Treatment): string {
  const label = TREATMENT_LABELS[treatment];
  const lines = header(`${label} spending`, period, today);
  const rows = categoryRows(store, summary.entries, treatment);
  if (summary.entries.length === 0) {
    lines.push("", noActivity(period));
  } else if (rows.length === 0) {
    lines.push("", `No ${label} spending or refunds in this period.`);
  } else {
    lines.push(
      "",
      indent(
        renderGrid(
          ["Category", ...AMOUNT_HEADER],
          [...rows.map(({ categoryId, split }) => [categoryName(store, categoryId), ...amountCells(split)]), [`${label} total`, ...amountCells(summary.spending[treatment])]],
          [1, 2, 3, 4, 5, 6],
        ),
      ),
    );
  }
  lines.push("", ...limitLines(store, period, treatment, today));
  lines.push("", `Drill down: kakeibo spending ${periodFlag(period)} --envelope ${label.includes(" ") ? `"${label}"` : label} --category <name>`);
  return lines.join("\n");
}

/** A purchase adds to spending and a refund subtracts, so the column adds up to net spending. */
function spendingAmount(entry: Entry): Pence {
  return entry.purpose === "refund" ? negatePence(entry.source.amount) : entry.source.amount;
}

function renderEntries(store: Store, summary: PeriodSummary, period: ReportPeriod, today: IsoDate, treatment: Treatment, categoryId: string): string {
  const label = `${TREATMENT_LABELS[treatment]} / ${categoryName(store, categoryId)}`;
  const lines = header(`${label} spending`, period, today);
  const entries = spendingEntries(summary.entries, treatment, categoryId);
  const account = (entry: Entry): string => store.accounts.find((candidate) => candidate.id === entry.account_id)?.name ?? entry.account_id;
  if (summary.entries.length === 0) {
    lines.push("", noActivity(period));
  } else if (entries.length === 0) {
    lines.push("", `No ${label} spending or refunds in this period.`);
  } else {
    const split = categorySpendingTotals(entries, treatment)[0]?.split as ReviewSplit;
    const total = splitTotal(split);
    lines.push(
      "",
      renderGrid(
        ["ID", "Date", "Account", "Description", "Type", "Treatment / category", "Amount", "Review", "Note"],
        entries.map((entry) => [
          entry.id,
          entry.source.posted_date,
          account(entry),
          entry.source.description,
          typeLabel(entry),
          classificationLabel(store, entry),
          formatPence(spendingAmount(entry)),
          entry.review_state,
          entryNote(store, entry),
        ]),
        [6],
      ),
      "",
      `Total: gross ${formatPence(total.gross)} · refunds ${formatPence(total.refunds)} · net ${formatPence(total.net)} · reviewed ${formatPence(split.reviewed.net)} · unreviewed ${formatPence(split.unreviewed.net)} · entries ${total.count}`,
    );
  }
  const excluded = summary.entries.filter((entry) => isExcludedDuplicate(entry) && entry.treatment === treatment && entry.category_id === categoryId);
  if (excluded.length > 0) {
    lines.push("", "Not counted (excluded duplicates):");
    for (const entry of excluded) lines.push(`  ${entry.id} ${entry.source.posted_date} ${entry.source.description} ${formatPence(spendingAmount(entry))} · ${entryNote(store, entry)}`);
  }
  return lines.join("\n");
}
