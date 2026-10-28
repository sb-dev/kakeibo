import {
  NORMALISATION_VERSION,
  parseIsoDate,
  type Account,
  type AmountLayout,
  type CsvDelimiter,
  type DateFormat,
  type ImportCoverage,
  type IsoDate,
  type ProposalReason,
  type SourceValues,
  type Store,
} from "@kakeibo/domain";
import type { CommandContext } from "../context.ts";
import { CliError, NotInteractiveError, UsageError } from "../errors.ts";
import { renderGrid } from "../format/table.ts";
import { CsvFormatError, guessDelimiter, parseCsv, readCsvFile, type CsvFile, type ParsedCsv } from "../import/csv.ts";
import {
  describeMapping,
  describeRowError,
  mappedColumns,
  missingColumns,
  normaliseRows,
  sameSettings,
  settingsOf,
  signedDisplay,
  type MappingSettings,
  type NormalisedRow,
} from "../import/mapping.ts";
import { applyImport, findExactFileImport, planImport, undecidedRows, type Decision, type ImportInput, type ImportPlan, type RowPlan } from "../import/reconcile.ts";
import type { Choice } from "../prompts/prompter.ts";
import { loadStore, updateStore } from "../storage/store-file.ts";

export type ImportOptions = {
  readonly account: string;
  readonly remap?: boolean;
};

const MAX_REPORTED_ROW_ERRORS = 20;
const NONE = "";

const REASON_LABELS: Readonly<Record<ProposalReason, string>> = {
  incoming_not_complete: "this file is not declared complete for the date",
  incompatible_mapping: "earlier coverage used an incompatible mapping",
  uncertain_coverage: "earlier coverage of the date is unknown",
  changed_value: "same date, changed values",
  source_id_missing: "the row has no source ID; the entry has one",
};

function findAccount(store: Store, name: string): Account | undefined {
  const wanted = name.toLowerCase();
  return store.accounts.find((account) => account.name.toLowerCase() === wanted);
}

function latestMapping(store: Store, account: Account | undefined) {
  return account === undefined ? undefined : store.mappings.filter((mapping) => mapping.account_id === account.id).at(-1);
}

async function selectColumn(
  context: CommandContext,
  message: string,
  header: readonly string[],
  previous: string | undefined,
  optional: boolean,
): Promise<string | undefined> {
  const choices: Choice[] = header.filter((name) => name !== "").map((name) => ({ value: name, name }));
  if (optional) choices.unshift({ value: NONE, name: "(none)" });
  const fallback = optional ? NONE : choices[0]?.value;
  const defaultValue = previous !== undefined && header.includes(previous) ? previous : fallback;
  const answer = await context.prompter.select(message, choices, defaultValue);
  return answer === NONE ? undefined : answer;
}

/** Ask for every mapping choice. Earlier answers are defaults under --remap. */
async function askMapping(context: CommandContext, file: CsvFile, previous: MappingSettings | undefined): Promise<{ settings: MappingSettings; csv: ParsedCsv }> {
  for (;;) {
    const delimiter = (await context.prompter.select(
      "Delimiter",
      [
        { value: ",", name: "Comma (,)" },
        { value: ";", name: "Semicolon (;)" },
      ],
      previous?.delimiter ?? guessDelimiter(file.text),
    )) as CsvDelimiter;
    const csv = parseCsv(file, delimiter);
    const header = csv.header;
    if (header.filter((name) => name !== "").length < 3) {
      throw new CsvFormatError(
        `${file.name} has fewer than three named columns with '${delimiter}' delimiters. Check the delimiter and the header row.`,
      );
    }
    context.out(`Columns: ${header.map((name) => `'${name}'`).join(", ")}`);

    const date_column = (await selectColumn(context, "Posted date column", header, previous?.date_column, false)) as string;
    const date_format = (await context.prompter.select(
      "Date format",
      [
        { value: "YYYY-MM-DD", name: "YYYY-MM-DD (2026-10-19)" },
        { value: "DD/MM/YYYY", name: "DD/MM/YYYY (19/10/2026)" },
      ],
      previous?.date_format,
    )) as DateFormat;
    const description_column = (await selectColumn(context, "Description column", header, previous?.description_column, false)) as string;
    const layout = await context.prompter.select(
      "Amount layout",
      [
        { value: "signed", name: "One amount column with a sign" },
        { value: "debit_credit", name: "Separate money-out (debit) and money-in (credit) columns" },
      ],
      previous?.amount.kind,
    );
    let amount: AmountLayout;
    if (layout === "signed") {
      const column = (await selectColumn(context, "Amount column", header, previous?.amount.kind === "signed" ? previous.amount.column : undefined, false)) as string;
      const sign = await context.prompter.select(
        "Which sign means money out? Bank and credit-card exports often differ.",
        [
          { value: "negative", name: "Negative amounts are money out (typical bank account)" },
          { value: "positive", name: "Positive amounts are money out (typical credit card)" },
        ],
        previous?.amount.kind === "signed" ? previous.amount.money_out_sign : undefined,
      );
      amount = { kind: "signed", column, money_out_sign: sign === "positive" ? "positive" : "negative" };
    } else {
      const previousLayout = previous?.amount.kind === "debit_credit" ? previous.amount : undefined;
      const debit_column = (await selectColumn(context, "Money-out (debit) column", header, previousLayout?.debit_column, false)) as string;
      const credit_column = (await selectColumn(context, "Money-in (credit) column", header, previousLayout?.credit_column, false)) as string;
      amount = { kind: "debit_credit", debit_column, credit_column };
    }
    const source_id_column = await selectColumn(context, "Source transaction ID column (optional)", header, previous?.source_id_column, true);
    const currency_column = await selectColumn(context, "Currency column (optional)", header, previous?.currency_column, true);
    const reference_column = await selectColumn(context, "Stable reference column (optional)", header, previous?.reference_column, true);

    const settings: MappingSettings = {
      delimiter,
      header,
      date_column,
      date_format,
      description_column,
      amount,
      ...(source_id_column === undefined ? {} : { source_id_column }),
      ...(currency_column === undefined ? {} : { currency_column }),
      ...(reference_column === undefined ? {} : { reference_column }),
      normalisation_version: NORMALISATION_VERSION,
    };
    const columns = mappedColumns(settings);
    const repeated = columns.filter((column, index) => columns.indexOf(column) !== index);
    if (repeated.length === 0) {
      return { settings, csv };
    }
    context.err(`Each column can be used once; '${repeated[0]}' was chosen more than once. Map the columns again.`);
  }
}

function dateSpan(rows: readonly NormalisedRow[]): { readonly first: IsoDate; readonly last: IsoDate } {
  const dates = rows.map((row) => row.values.posted_date).sort();
  return { first: dates[0] as IsoDate, last: dates.at(-1) as IsoDate };
}

async function askDate(context: CommandContext, message: string): Promise<IsoDate> {
  for (;;) {
    const answer = (await context.prompter.askText(message)).trim();
    const parsed = parseIsoDate(answer);
    if (parsed.ok) return parsed.value;
    context.err(`'${answer}' is not a date. Use YYYY-MM-DD, for example 2026-10-01.`);
  }
}

/** Coverage is declared by the user; it is never inferred from the first and last rows (Financial Model §10.3). */
async function askCoverage(context: CommandContext, rows: readonly NormalisedRow[]): Promise<ImportCoverage> {
  const span = dateSpan(rows);
  context.out(`Rows are posted from ${span.first} to ${span.last}. This does not show which dates the export covers completely.`);
  const answer = await context.prompter.select(
    "Does this file contain every posted transaction for this account between two dates?",
    [
      { value: "complete", name: "Yes: it is a complete export for a date range I will enter" },
      { value: "partial", name: "No: it is filtered or partial" },
      { value: "unknown", name: "Not sure" },
    ],
    "unknown",
  );
  if (answer === "partial") return { completeness: "partial" };
  if (answer !== "complete") return { completeness: "unknown" };
  for (;;) {
    const from = await askDate(context, "Complete from (YYYY-MM-DD)");
    const to = await askDate(context, "Complete to (YYYY-MM-DD)");
    if (from > to) {
      context.err(`The range starts after it ends (${from} to ${to}). Enter it again.`);
    } else if (span.first < from || span.last > to) {
      context.err(`Rows are posted from ${span.first} to ${span.last}, outside ${from} to ${to}. Enter a range that includes every row.`);
    } else {
      return { completeness: "complete", from, to, basis: "user_declaration" };
    }
  }
}

function describeCoverage(coverage: ImportCoverage): string {
  switch (coverage.completeness) {
    case "complete":
      return `complete for ${coverage.from} to ${coverage.to} (your declaration)`;
    case "partial":
      return "filtered or partial";
    case "unknown":
      return "not known";
  }
}

function rowCells(plan: RowPlan): string[] {
  const { values } = plan.row;
  return [String(plan.row.row), values.posted_date, values.description, signedDisplay(values)];
}

function counts(plan: ImportPlan) {
  const tally = { reused: 0, created: 0, undecided: 0, candidates: 0 };
  for (const row of plan.rows) {
    if (row.kind === "reuse" || (row.kind === "proposed" && row.decision === "reuse")) tally.reused += 1;
    else if (row.kind === "proposed" && row.decision === undefined) tally.undecided += 1;
    else tally.created += 1;
    if ((row.kind === "new" && row.duplicate_of !== undefined) || (row.kind === "proposed" && row.decision === "keep_separate" && row.reason !== "changed_value")) {
      tally.candidates += 1;
    }
  }
  return tally;
}

function missingCount(plan: ImportPlan): number {
  return plan.discrepancies.reduce((total, discrepancy) => total + discrepancy.missing_entry_ids.length, 0);
}

type PreviewContext = {
  readonly store: Store;
  readonly accountName: string;
  readonly account: Account | undefined;
  readonly file: CsvFile;
  readonly mappingLabel: string;
  readonly input: ImportInput;
};

function describeValues(values: SourceValues): string {
  return `${values.posted_date} ${values.description} ${signedDisplay(values)}`;
}

/** "tx_002 2026-10-02 Tesco Stores -£50.00 → 2026-10-02 Tesco Stores -£55.00": what a reuse would replace. */
function describeReplacement(store: Store, row: RowPlan & { readonly kind: "proposed" }): string {
  const retained = store.entries.find((entry) => entry.id === row.entry_id);
  return `${row.entry_id} ${retained === undefined ? "(unknown)" : describeValues(retained.source)} → ${describeValues(row.row.values)}`;
}

function renderPreview(preview: PreviewContext, plan: ImportPlan): string {
  const { input } = preview;
  const span = dateSpan(input.rows);
  const tally = counts(plan);
  const lines = [
    "Import preview",
    `Account: ${preview.account?.name ?? `${preview.accountName} (new; created with this import)`}`,
    `File: ${preview.file.name} (sha256 ${preview.file.sha256.slice(0, 12)}…)`,
    `Mapping: ${preview.mappingLabel}`,
    ...describeMapping(input.settings).map((line) => `  ${line}`),
    input.settings.currency_column === undefined
      ? "Currency: the file has no currency column; every amount will be recorded as GBP."
      : `Currency: GBP, checked in column '${input.settings.currency_column}'.`,
    `Rows: ${input.rows.length}, posted ${span.first} to ${span.last}`,
    `Coverage: ${describeCoverage(input.coverage)}`,
    `Reused ${tally.reused} · New ${tally.created} · Needs decision ${tally.undecided} · Duplicate candidates ${tally.candidates}`,
  ];

  const reused = plan.rows.filter((row) => row.kind === "reuse");
  if (reused.length > 0) {
    lines.push("", "Reused rows (existing entries keep their IDs, classification and review state):");
    lines.push(
      renderGrid(
        ["Row", "Date", "Description", "Amount", "Entry", "Basis"],
        reused.map((row) => [...rowCells(row), row.entry_id, row.basis === "source_id" ? "source ID" : "counted occurrence"]),
        [0, 3],
      ),
    );
  }
  const created = plan.rows.filter((row) => row.kind === "new");
  if (created.length > 0) {
    lines.push("", "New rows (added as unreviewed entries):");
    lines.push(
      renderGrid(
        ["Row", "Date", "Description", "Amount", "Note"],
        created.map((row) => [...rowCells(row), row.duplicate_of === undefined ? "" : `possible duplicate of ${row.duplicate_of}`]),
        [0, 3],
      ),
    );
  }
  const proposed = plan.rows.filter((row) => row.kind === "proposed");
  if (proposed.length > 0) {
    lines.push("", "Unresolved rows (each needs a decision: reuse the proposed entry or keep separate):");
    lines.push(
      renderGrid(
        ["Row", "Date", "Description", "Amount", "Proposed", "Reason", "Decision"],
        proposed.map((row) => [
          ...rowCells(row),
          row.entry_id,
          REASON_LABELS[row.reason],
          row.decision === undefined ? "(needed)" : row.decision === "reuse" ? "reuse" : "keep separate",
        ]),
        [0, 3],
      ),
    );
    const changed = proposed.filter((row) => row.reason === "changed_value");
    if (changed.length > 0) {
      lines.push("", "Changed values (retained entry → incoming row):");
      for (const row of changed) {
        lines.push(`  Row ${row.row.row}: ${describeReplacement(preview.store, row)}`);
      }
    }
  }
  if (plan.discrepancies.length > 0) {
    lines.push("", "Flagged dates (existing entries are kept; nothing is deleted):");
    for (const discrepancy of plan.discrepancies) {
      const parts = [
        discrepancy.missing_entry_ids.length > 0 ? `not in this file: ${discrepancy.missing_entry_ids.join(", ")}` : undefined,
        discrepancy.replaced_entry_ids.length > 0 ? `values replaced: ${discrepancy.replaced_entry_ids.join(", ")}` : undefined,
      ].filter((part) => part !== undefined);
      lines.push(`  ${discrepancy.posted_date}: ${parts.join("; ")}`);
    }
  }
  return lines.join("\n");
}

/** One bulk decision, then per-row overrides (Financial Model §10.3). */
async function askDecisions(context: CommandContext, store: Store, plan: ImportPlan): Promise<Map<number, Decision>> {
  const proposed = undecidedRows(plan).filter((row) => row.kind === "proposed");
  const bulk = (await context.prompter.select(
    `${proposed.length} row(s) need a decision. Apply which decision to all of them?`,
    [
      { value: "reuse", name: "Reuse the proposed existing entries" },
      { value: "keep_separate", name: "Keep them as separate new entries" },
    ],
  )) as Decision;
  const opposite: Decision = bulk === "reuse" ? "keep_separate" : "reuse";
  const overrides = new Set(
    await context.prompter.checkbox(
      `Select rows to override (they will ${opposite === "reuse" ? "reuse the proposed entry" : "be kept separate"}); select none to keep the bulk decision`,
      proposed.map((row) => ({
        value: String(row.row.row),
        name:
          row.reason === "changed_value"
            ? `Row ${row.row.row} · replace ${describeReplacement(store, row)}`
            : `Row ${row.row.row} · ${row.row.values.posted_date} · ${row.row.values.description} · ${signedDisplay(row.row.values)} → ${row.entry_id}`,
      })),
    ),
  );
  return new Map(proposed.map((row) => [row.row.row, overrides.has(String(row.row.row)) ? opposite : bulk]));
}

export async function runImport(context: CommandContext, file: string, options: ImportOptions): Promise<void> {
  const accountName = options.account.trim();
  if (accountName === "") {
    throw new UsageError("--account needs a name, for example --account current.");
  }
  if (!context.interactive) {
    throw new NotInteractiveError("import", "Run it in a terminal to map columns, preview the rows and confirm the import.");
  }

  const store = await loadStore(context.paths);
  const account = findAccount(store, accountName);
  const csvFile = await readCsvFile(file);
  const saved = latestMapping(store, account);

  let settings: MappingSettings;
  let csv: ParsedCsv;
  if (saved !== undefined && options.remap !== true) {
    settings = settingsOf(saved);
    csv = parseCsv(csvFile, settings.delimiter);
    const missing = missingColumns(settings, csv.header);
    if (missing.length > 0) {
      throw new CliError(
        `${csvFile.name} does not match the saved mapping for '${account?.name}': missing column(s) ${missing.map((name) => `'${name}'`).join(", ")}. ` +
          `If the export format changed, run the command again with --remap.`,
      );
    }
    context.out(`Using saved mapping version ${saved.version} for '${account?.name}'.`);
  } else {
    if (account === undefined) context.out(`Account '${accountName}' does not exist yet. It will be created when you confirm this import.`);
    ({ settings, csv } = await askMapping(context, csvFile, saved === undefined ? undefined : settingsOf(saved)));
  }

  const normalised = normaliseRows(settings, csv);
  if (!normalised.ok) {
    for (const error of normalised.error.slice(0, MAX_REPORTED_ROW_ERRORS)) {
      context.err(describeRowError(error));
    }
    if (normalised.error.length > MAX_REPORTED_ROW_ERRORS) {
      context.err(`… and ${normalised.error.length - MAX_REPORTED_ROW_ERRORS} more`);
    }
    throw new CliError(`Import aborted: ${csvFile.name} has ${normalised.error.length} invalid value(s). Fix the file or the mapping and run it again.`);
  }
  const rows = normalised.value;

  const exact = findExactFileImport(store, account?.id, csvFile.sha256, rows);
  if (exact !== undefined) {
    context.out(`${csvFile.name} was already imported into '${account?.name}' as ${exact.id} on ${exact.imported_at}. Nothing to import. No data was changed.`);
    return;
  }

  const coverage = await askCoverage(context, rows);
  const input: ImportInput = { accountId: account?.id, settings, rows, coverage };
  let plan = planImport(store, input);
  if (plan.conflicts.length > 0) {
    for (const conflict of plan.conflicts) {
      context.err(
        `Row ${conflict.row.row} (line ${conflict.row.line}): source ID '${conflict.row.values.source_id}' was imported before as ` +
          `${conflict.source_record.id} (entry ${conflict.source_record.entry_id}) with different ${conflict.fields.join(", ")}.`,
      );
    }
    throw new CliError("Import aborted: source IDs conflict with earlier imports, and history is never overwritten.");
  }

  const mappingLabel =
    saved !== undefined && sameSettings(settingsOf(saved), settings)
      ? `saved version ${saved.version}`
      : `new version ${(account === undefined ? 0 : store.mappings.filter((mapping) => mapping.account_id === account.id).length) + 1} (saved with this import)`;
  const preview: PreviewContext = { store, accountName, account, file: csvFile, mappingLabel, input };
  context.out(renderPreview(preview, plan));

  if (undecidedRows(plan).length > 0) {
    const decisions = await askDecisions(context, store, plan);
    plan = planImport(store, input, decisions);
    context.out(renderPreview(preview, plan));
  }

  const tally = counts(plan);
  const missing = missingCount(plan);
  const keeping = missing > 0 ? `, keeping ${missing} existing entr${missing === 1 ? "y" : "ies"} this file does not contain` : "";
  const confirmed = await context.prompter.confirm(
    `Import ${plan.rows.length} row(s) into '${account?.name ?? accountName}' (${tally.created} new, ${tally.reused} reused${keeping})?`,
    false,
  );
  if (!confirmed) {
    context.out("Import cancelled. No data was changed.");
    return;
  }

  const applied = await updateStore(context.paths, (current) => {
    // The preview was computed from `store`. Any other change since then could alter matches.
    if (JSON.stringify(current) !== JSON.stringify(store)) {
      throw new CliError("The store changed while you were importing. Run the command again to preview the current state.");
    }
    const result = applyImport(current, input, plan, {
      accountName,
      fileName: csvFile.name,
      sha256: csvFile.sha256,
      now: context.now().toISOString(),
    });
    return { store: result.store, result };
  });
  const candidates = applied.created.filter((entry) => entry.duplicate !== undefined).length;
  context.out(
    `Imported ${csvFile.name} into '${applied.account.name}' as ${applied.import.id}: ${applied.created.length} new unreviewed entr${applied.created.length === 1 ? "y" : "ies"}, ` +
      `${tally.reused} reused${candidates > 0 ? `, ${candidates} possible duplicate(s) to resolve in review` : ""}.`,
  );
  context.out(`Saved to ${context.paths.store}`);
}
