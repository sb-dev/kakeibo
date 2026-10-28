import {
  ENVELOPES,
  TREATMENT_LABELS,
  addPence,
  currentPlanRevision,
  datesInRange,
  dayOfWeek,
  entriesInRange,
  entryRevision,
  entryTypeOf,
  findReview,
  formatPence,
  goalContributions,
  linkFor,
  monthOf,
  monthSegments,
  monthStartOf,
  pence,
  reviewStatus,
  spendingTotals,
  subPence,
  sumPence,
  weekEndOf,
  weekEntries,
  type Entry,
  type IsoDate,
  type MatchBasis,
  type Pence,
  type ReviewSplit,
  type Store,
  type Treatment,
} from "@kakeibo/domain";
import { renderGrid } from "../format/table.ts";
import { signedDisplay } from "../import/mapping.ts";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const SPENDING_ROWS: readonly Treatment[] = ["fixed", ...ENVELOPES, "outside_plan", "unclassified"];

const MATCH_LABELS: Readonly<Record<MatchBasis, string>> = {
  new: "created this entry",
  source_id: "reused by source ID",
  occurrence_count: "reused (counted occurrence)",
  user_reuse: "reused by your decision",
  user_keep_separate: "kept separate by your decision",
  reuse_reversed: "reuse reversed",
};

/** "Spending", "Refund", … for the entry's movement and purpose. */
export function typeLabel(entry: Pick<Entry, "movement" | "purpose">): string {
  return entryTypeOf(entry)?.name ?? `${entry.movement}/${entry.purpose}`;
}

export function categoryName(store: Store, categoryId: string): string {
  return store.categories.find((category) => category.id === categoryId)?.name ?? categoryId;
}

/** "Needs / Groceries". */
export function classificationLabel(store: Store, entry: Pick<Entry, "treatment" | "category_id">): string {
  return `${TREATMENT_LABELS[entry.treatment]} / ${categoryName(store, entry.category_id)}`;
}

function duplicateNote(entry: Entry): string | undefined {
  const duplicate = entry.duplicate;
  switch (duplicate?.status) {
    case undefined:
      return undefined;
    case "candidate":
      return `duplicate? of ${duplicate.of_entry_id}`;
    case "excluded":
      return `excluded duplicate of ${duplicate.of_entry_id}`;
    case "kept":
      return `kept; not a duplicate of ${duplicate.of_entry_id}`;
  }
}

/** Short attention note: duplicate state and Savings-goal link. */
export function entryNote(store: Store, entry: Entry): string {
  const notes: string[] = [];
  const duplicate = duplicateNote(entry);
  if (duplicate !== undefined) notes.push(duplicate);
  const link = linkFor(store, entry.id);
  if (link !== undefined) notes.push(`Savings goal ${link.id}`);
  return notes.join("; ");
}

/** "tx_001 2026-10-19 TESCO -£50.00 · Needs / Groceries · unreviewed". */
export function describeEntry(store: Store, entry: Entry): string {
  const note = entryNote(store, entry);
  return [
    `${entry.id} ${entry.source.posted_date} ${entry.source.description} ${signedDisplay(entry.source)}`,
    `${typeLabel(entry)}, ${classificationLabel(store, entry)}`,
    entry.review_state,
    ...(note === "" ? [] : [note]),
  ].join(" · ");
}

export function entryGrid(store: Store, entries: readonly Entry[]): string {
  return renderGrid(
    ["ID", "Date", "Description", "Amount", "Type", "Treatment / category", "Review", "Note"],
    entries.map((entry) => [
      entry.id,
      entry.source.posted_date,
      entry.source.description,
      signedDisplay(entry.source),
      typeLabel(entry),
      classificationLabel(store, entry),
      entry.review_state,
      entryNote(store, entry),
    ]),
    [3],
  );
}

/** Sum of the source amounts as money out minus money in, for selection previews. */
export function selectionTotal(entries: readonly Entry[]): string {
  const out = sumPence(entries.filter((entry) => entry.source.source_movement === "outflow").map((entry) => entry.source.amount));
  const inflow = sumPence(entries.filter((entry) => entry.source.source_movement === "inflow").map((entry) => entry.source.amount));
  if (inflow === 0) return `${formatPence(out)} money out`;
  if (out === 0) return `${formatPence(inflow)} money in`;
  return `${formatPence(out)} money out, ${formatPence(inflow)} money in`;
}

function day(date: IsoDate): string {
  return `${DAY_NAMES[dayOfWeek(date)]} ${date}`;
}

function inRange(date: IsoDate, from: IsoDate, to: IsoDate): boolean {
  return from <= date && date <= to;
}

function statusLine(store: Store, weekStart: IsoDate): string {
  const status = reviewStatus(store, weekStart);
  switch (status.state) {
    case "not_closed":
      return "Review: not closed";
    case "closed":
      return `Review: closed ${status.closure.closed_at}`;
    case "changed_since_review": {
      const parts = [
        status.added.length > 0 ? `added ${status.added.join(", ")}` : undefined,
        status.revised.length > 0 ? `changed ${status.revised.join(", ")}` : undefined,
        status.removed.length > 0 ? `moved out ${status.removed.join(", ")}` : undefined,
      ].filter((part) => part !== undefined);
      return `Review: CHANGED SINCE REVIEW (closed ${status.closure.closed_at}; ${parts.join("; ")})`;
    }
  }
}

function weekSpending(store: Store, weekStart: IsoDate, entries: readonly Entry[]): string[] {
  const totals = spendingTotals(entries);
  const lines = [
    "Spending this week (net of refunds; refunds are never income)",
    renderGrid(
      ["Treatment", "Reviewed", "Unreviewed"],
      SPENDING_ROWS.map((treatment) => [TREATMENT_LABELS[treatment], formatPence(totals[treatment].reviewed.net), formatPence(totals[treatment].unreviewed.net)]),
      [1, 2],
    ),
  ];
  const sum = (purpose: Entry["purpose"]): Pence =>
    sumPence(entries.filter((entry) => entry.purpose === purpose && entry.duplicate?.status !== "excluded").map((entry) => entry.source.amount));
  const contributions = goalContributions(store, weekStart, weekEndOf(weekStart));
  lines.push(
    `Not spending: income ${formatPence(sum("income"))} · transfers ${formatPence(sum("transfer"))} · ` +
      `Savings-goal contributions ${formatPence(sumPence(contributions.map((contribution) => contribution.amount)))} (${contributions.length}, counted once per transfer)`,
  );
  return lines;
}

function monthToDate(store: Store, weekStart: IsoDate, today: IsoDate): string[] {
  const lines = ["Month to date (each month against its own plan)"];
  for (const segment of monthSegments(weekStart, weekEndOf(weekStart))) {
    const from = monthStartOf(segment.month);
    const plan = currentPlanRevision(store, segment.month);
    const progress = monthOf(today) === segment.month && today <= segment.to ? " (in progress)" : "";
    const totals = spendingTotals(entriesInRange(store, from, segment.to));
    lines.push("", `${segment.month}: ${from} to ${segment.to}${progress}`);
    if (plan === undefined) {
      lines.push(`  No plan saved for ${segment.month}. Run \`kakeibo plan --month ${segment.month}\` to create one.`);
    } else {
      lines.push(`  Plan revision ${plan.revision} · Intention: ${plan.intention ?? "(none)"}`);
    }
    const row = (label: string, limit: Pence | undefined, split: ReviewSplit): string[] => [
      label,
      limit === undefined ? "no plan" : formatPence(limit),
      formatPence(split.reviewed.net),
      formatPence(split.unreviewed.net),
      limit === undefined ? "—" : formatPence(subPence(limit, split.reviewed.net)),
    ];
    const rows = ENVELOPES.map((envelope) => row(TREATMENT_LABELS[envelope], plan?.envelopes[envelope], totals[envelope]));
    const flexible = ENVELOPES.reduce(
      (total, envelope) => ({
        reviewed: { ...total.reviewed, net: addPence(total.reviewed.net, totals[envelope].reviewed.net) },
        unreviewed: { ...total.unreviewed, net: addPence(total.unreviewed.net, totals[envelope].unreviewed.net) },
      }),
      { reviewed: { gross: pence(0), refunds: pence(0), net: pence(0), count: 0 }, unreviewed: { gross: pence(0), refunds: pence(0), net: pence(0), count: 0 } },
    );
    rows.push(row("Flexible total", plan === undefined ? undefined : sumPence(ENVELOPES.map((envelope) => plan.envelopes[envelope])), flexible));
    rows.push(row("Fixed", plan?.fixed_commitments, totals.fixed));
    lines.push(
      renderGrid(["Envelope", "Limit", "Reviewed", "Unreviewed", "Reviewed remaining"], rows, [1, 2, 3, 4])
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n"),
    );
    lines.push(`  Unclassified spending month to date: ${formatPence(addPence(totals.unclassified.reviewed.net, totals.unclassified.unreviewed.net))}`);
  }
  return lines;
}

/**
 * The weekly review report (PRD §4.4): period, closure status, envelope totals, unresolved entries,
 * duplicate candidates, the full-week scan, month-to-date comparisons, reflection and closures.
 * Plain text only, so it works when output is redirected.
 */
export function renderWeek(store: Store, weekStart: IsoDate, today: IsoDate): string {
  const weekEnd = weekEndOf(weekStart);
  const entries = weekEntries(store, weekStart);
  const review = findReview(store, weekStart);
  const progress = inRange(today, weekStart, weekEnd) ? " (in progress)" : "";
  const reviewed = entries.filter((entry) => entry.review_state === "reviewed" && entry.duplicate?.status !== "excluded").length;
  const excluded = entries.filter((entry) => entry.duplicate?.status === "excluded").length;
  const lines = [`Week ${weekStart} to ${weekEnd}${progress}`, statusLine(store, weekStart)];

  if (entries.length === 0) {
    lines.push("No imported activity in this week. Reports describe imported activity only.");
  } else {
    lines.push(
      `Entries: ${entries.length} · reviewed ${reviewed} · unreviewed ${entries.length - reviewed - excluded} · excluded duplicates ${excluded}`,
      "Totals describe imported activity only; they are not a bank balance.",
      "",
      ...weekSpending(store, weekStart, entries),
    );

    const unresolved = entries.filter((entry) => entry.treatment === "unclassified" && entry.duplicate?.status !== "excluded");
    lines.push("", `Unresolved classifications: ${unresolved.length}${unresolved.length > 0 ? ` (${selectionTotal(unresolved)})` : ""}`);
    if (unresolved.length > 0) lines.push(entryGrid(store, unresolved));

    const candidates = entries.filter((entry) => entry.duplicate?.status === "candidate");
    lines.push("", `Duplicate candidates: ${candidates.length}`);
    for (const candidate of candidates) {
      const retained = store.entries.find((entry) => entry.id === candidate.duplicate?.of_entry_id);
      lines.push(`  ${describeEntry(store, candidate)}`, `    retained: ${retained === undefined ? candidate.duplicate?.of_entry_id : describeEntry(store, retained)}`);
    }

    lines.push("", "All entries by day");
    const rows: string[][] = [];
    for (const date of datesInRange(weekStart, weekEnd)) {
      const onDay = entries.filter((entry) => entry.source.posted_date === date);
      if (onDay.length === 0) rows.push([day(date), "", "no imported activity", "", "", "", "", ""]);
      onDay.forEach((entry, index) =>
        rows.push([
          index === 0 ? day(date) : "",
          entry.id,
          entry.source.description,
          signedDisplay(entry.source),
          typeLabel(entry),
          classificationLabel(store, entry),
          entry.review_state,
          entryNote(store, entry),
        ]),
      );
    }
    lines.push(renderGrid(["Day", "ID", "Description", "Amount", "Type", "Treatment / category", "Review", "Note"], rows, [3]));
  }

  lines.push("", ...monthToDate(store, weekStart, today));
  lines.push(
    "",
    "Reflection",
    `  What stood out? ${review?.reflection?.stood_out ?? "(not written)"}`,
    `  What will you change next week? ${review?.reflection?.next_change ?? "(not written)"}`,
  );
  if (review !== undefined && review.closures.length > 0) {
    lines.push("", "Closures");
    for (const closure of review.closures) lines.push(`  ${closure.closed_at}: ${closure.entries.length} entr${closure.entries.length === 1 ? "y" : "ies"}`);
  }
  return lines.join("\n");
}

/** Full detail of one entry, including every source observation linked to it (PRD §§3, 5). */
export function renderEntryDetail(store: Store, entry: Entry): string {
  const account = store.accounts.find((candidate) => candidate.id === entry.account_id);
  const link = linkFor(store, entry.id);
  const lines = [
    `Entry ${entry.id} (revision ${entryRevision(entry)})`,
    `Account: ${account?.name ?? entry.account_id}`,
    `Posted: ${entry.source.posted_date}`,
    `Description: ${entry.source.description}`,
    `Amount: ${signedDisplay(entry.source)} (money ${entry.source.source_movement === "outflow" ? "out" : "in"})`,
    `Type: ${typeLabel(entry)}`,
    `Treatment / category: ${classificationLabel(store, entry)}`,
    `Review state: ${entry.review_state}`,
  ];
  const duplicate = duplicateNote(entry);
  if (duplicate !== undefined) lines.push(`Duplicate: ${duplicate}`);
  if (link !== undefined) {
    const others = link.entry_ids.filter((id) => id !== entry.id);
    lines.push(`Savings goal: ${link.id}${others.length > 0 ? `, with the other account side ${others.join(", ")}` : ", one account side"}`);
  }

  lines.push("", "Source observations");
  const sources = store.source_records.filter((source) => source.entry_id === entry.id);
  if (sources.length === 0) lines.push("  (none)");
  for (const source of sources) {
    const record = store.imports.find((candidate) => candidate.id === source.import_id);
    const raw = Object.entries(source.raw)
      .map(([column, cell]) => `${column}=${cell}`)
      .join(", ");
    lines.push(`  ${source.id}: ${source.import_id} ${record?.file_name ?? ""} row ${source.row} (line ${source.line}), ${MATCH_LABELS[source.match.basis]}`, `    raw: ${raw}`);
  }
  const reversed = store.source_records.filter((source) => source.match.reversed_from_entry_id === entry.id);
  if (reversed.length > 0) {
    lines.push("Reversed source rows (now separate entries):");
    for (const source of reversed) lines.push(`  ${source.id} → ${source.entry_id}`);
  }
  return lines.join("\n");
}
