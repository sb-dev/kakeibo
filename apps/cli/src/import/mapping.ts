import {
  STORE_CURRENCY,
  err,
  formatPence,
  ok,
  parseIsoDate,
  parseMoney,
  type CsvMapping,
  type DateFormat,
  type IsoDate,
  type Pence,
  type Result,
  type SourceMovement,
  type SourceValues,
} from "@kakeibo/domain";
import type { CsvRecord, ParsedCsv } from "./csv.ts";

/** The user's mapping choices: a mapping before it is saved as an account version. */
export type MappingSettings = Omit<CsvMapping, "id" | "account_id" | "version" | "confirmed_at">;

export type NormalisedRow = {
  readonly row: number;
  readonly line: number;
  readonly raw: Readonly<Record<string, string>>;
  readonly values: SourceValues;
};

export type RowError = {
  readonly row: number;
  readonly line: number;
  readonly column?: string;
  readonly message: string;
};

export function settingsOf(mapping: CsvMapping): MappingSettings {
  const { id: _id, account_id: _account, version: _version, confirmed_at: _confirmed, ...settings } = mapping;
  return settings;
}

/** Columns a mapping reads, in a stable order. */
export function mappedColumns(settings: MappingSettings): string[] {
  const amountColumns = settings.amount.kind === "signed" ? [settings.amount.column] : [settings.amount.debit_column, settings.amount.credit_column];
  return [
    settings.date_column,
    settings.description_column,
    ...amountColumns,
    ...[settings.source_id_column, settings.currency_column, settings.reference_column].filter((column) => column !== undefined),
  ];
}

/** Mapped columns that the file's header lacks. */
export function missingColumns(settings: MappingSettings, header: readonly string[]): string[] {
  return mappedColumns(settings).filter((column) => !header.includes(column));
}

function canonicalSettings(settings: MappingSettings): string {
  const amount =
    settings.amount.kind === "signed"
      ? [settings.amount.kind, settings.amount.column, settings.amount.money_out_sign]
      : [settings.amount.kind, settings.amount.debit_column, settings.amount.credit_column];
  return JSON.stringify([
    settings.delimiter,
    settings.header,
    settings.date_column,
    settings.date_format,
    settings.description_column,
    amount,
    settings.source_id_column ?? null,
    settings.currency_column ?? null,
    settings.reference_column ?? null,
    settings.normalisation_version,
  ]);
}

/** True when two sets of answers would produce the same mapping version. */
export function sameSettings(a: MappingSettings, b: MappingSettings): boolean {
  return canonicalSettings(a) === canonicalSettings(b);
}

/**
 * Whether source values produced by two mappings can be reconciled automatically (Financial Model §10.3).
 * Header changes alone are compatible; changed date, amount, description, reference or source-ID
 * conventions are not, because the same bank row could normalise differently.
 */
export function mappingsCompatible(a: MappingSettings, b: MappingSettings): boolean {
  const amountKey = (settings: MappingSettings): string =>
    settings.amount.kind === "signed" ? `signed:${settings.amount.money_out_sign}` : "debit_credit";
  return (
    a.normalisation_version === b.normalisation_version &&
    a.date_format === b.date_format &&
    amountKey(a) === amountKey(b) &&
    a.description_column === b.description_column &&
    a.reference_column === b.reference_column &&
    (a.source_id_column === undefined) === (b.source_id_column === undefined)
  );
}

export function describeSignConvention(settings: MappingSettings): string {
  if (settings.amount.kind === "debit_credit") {
    return `'${settings.amount.debit_column}' is money out and '${settings.amount.credit_column}' is money in`;
  }
  return settings.amount.money_out_sign === "negative"
    ? `in '${settings.amount.column}', negative amounts are money out and positive amounts are money in`
    : `in '${settings.amount.column}', positive amounts are money out and negative amounts are money in`;
}

export function describeMapping(settings: MappingSettings): string[] {
  const optional = (label: string, column: string | undefined): string => `${label}: ${column === undefined ? "(none)" : `'${column}'`}`;
  return [
    `Delimiter: ${settings.delimiter === "," ? "comma" : "semicolon"}`,
    `Posted date: '${settings.date_column}' (${settings.date_format})`,
    `Description: '${settings.description_column}'`,
    `Amount sign: ${describeSignConvention(settings)}`,
    optional("Source transaction ID column", settings.source_id_column),
    optional("Currency column", settings.currency_column),
    optional("Stable reference column", settings.reference_column),
  ];
}

/** Trim and collapse whitespace. Deliberately conservative: case and punctuation are kept. */
export function normaliseText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

const DMY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseSourceDate(cell: string, format: DateFormat): IsoDate | undefined {
  const text = cell.trim();
  let iso: string;
  if (format === "YYYY-MM-DD") {
    if (!YMD_PATTERN.test(text)) return undefined;
    iso = text;
  } else {
    const match = DMY_PATTERN.exec(text);
    if (match === null) return undefined;
    iso = `${match[3]}-${match[2]}-${match[1]}`;
  }
  const parsed = parseIsoDate(iso);
  return parsed.ok ? parsed.value : undefined;
}

type AmountResult = { readonly ok: true; readonly value: Pence | undefined } | { readonly ok: false; readonly message: string };

/** Decimal-point amount with an optional sign; blank → undefined. Exact pence via the domain parser. */
function parseSourceAmount(cell: string): AmountResult {
  const text = cell.trim();
  if (text === "") return { ok: true, value: undefined };
  const parsed = parseMoney(text.startsWith("+") ? text.slice(1) : text);
  if (parsed.ok) return { ok: true, value: parsed.value };
  switch (parsed.error.code) {
    case "excess_precision":
      return { ok: false, message: `'${text}' has more than two decimal places` };
    case "unsafe_integer":
      return { ok: false, message: `'${text}' is too large to store exactly` };
    default:
      return { ok: false, message: `'${text}' is not an amount; use a decimal point, for example -12.50` };
  }
}

function magnitude(value: Pence): Pence {
  return Math.abs(value) as Pence;
}

/**
 * Apply a mapping to every data row. Validates the entire file and returns every error found,
 * so a malformed required value aborts the import with its row and field (PRD §4.1).
 */
export function normaliseRows(settings: MappingSettings, csv: ParsedCsv): Result<NormalisedRow[], RowError[]> {
  const index = new Map(csv.header.map((name, position) => [name, position]));
  const errors: RowError[] = [];
  const rows: NormalisedRow[] = [];
  const sourceIds = new Map<string, number>();

  for (const record of csv.records) {
    const fail = (column: string | undefined, message: string): void => {
      errors.push({ row: record.row, line: record.line, ...(column === undefined ? {} : { column }), message });
    };
    const cell = (column: string): string => record.cells[index.get(column) ?? -1] ?? "";
    const errorsBefore = errors.length;

    const posted_date = parseSourceDate(cell(settings.date_column), settings.date_format);
    if (posted_date === undefined) {
      fail(settings.date_column, `'${cell(settings.date_column).trim()}' is not a valid ${settings.date_format} date`);
    }

    const description = normaliseText(cell(settings.description_column));
    if (description === "") fail(settings.description_column, "description is empty");

    let movement: SourceMovement | undefined;
    let amount: Pence | undefined;
    if (settings.amount.kind === "signed") {
      const column = settings.amount.column;
      const parsed = parseSourceAmount(cell(column));
      if (!parsed.ok) fail(column, parsed.message);
      else if (parsed.value === undefined) fail(column, "amount is empty");
      else if (parsed.value === 0) fail(column, "amount is zero, so its direction is unknown");
      else {
        const negative = parsed.value < 0;
        movement = negative === (settings.amount.money_out_sign === "negative") ? "outflow" : "inflow";
        amount = magnitude(parsed.value);
      }
    } else {
      const { debit_column, credit_column } = settings.amount;
      const debit = parseSourceAmount(cell(debit_column));
      const credit = parseSourceAmount(cell(credit_column));
      if (!debit.ok) fail(debit_column, debit.message);
      if (!credit.ok) fail(credit_column, credit.message);
      if (debit.ok && credit.ok) {
        const out = debit.value ?? (0 as Pence);
        const into = credit.value ?? (0 as Pence);
        if (out < 0) fail(debit_column, "debit amounts must not be negative");
        else if (into < 0) fail(credit_column, "credit amounts must not be negative");
        else if (out !== 0 && into !== 0) fail(undefined, `both '${debit_column}' and '${credit_column}' have amounts`);
        else if (out === 0 && into === 0) fail(undefined, `neither '${debit_column}' nor '${credit_column}' has an amount`);
        else {
          movement = out !== 0 ? "outflow" : "inflow";
          amount = out !== 0 ? out : into;
        }
      }
    }

    if (settings.currency_column !== undefined) {
      const currency = cell(settings.currency_column).trim();
      if (currency.toUpperCase() !== STORE_CURRENCY) {
        fail(settings.currency_column, currency === "" ? "currency is empty" : `currency '${currency}' is not supported; this release imports GBP only`);
      }
    }

    const source_id = settings.source_id_column === undefined ? "" : cell(settings.source_id_column).trim();
    if (source_id !== "") {
      const earlier = sourceIds.get(source_id);
      if (earlier !== undefined) fail(settings.source_id_column, `source ID '${source_id}' already appears on row ${earlier}`);
      else sourceIds.set(source_id, record.row);
    }
    const reference = settings.reference_column === undefined ? "" : normaliseText(cell(settings.reference_column));

    if (errors.length === errorsBefore && posted_date !== undefined && movement !== undefined && amount !== undefined) {
      rows.push({
        row: record.row,
        line: record.line,
        raw: rawValues(csv.header, record),
        values: {
          posted_date,
          description,
          currency: STORE_CURRENCY,
          source_movement: movement,
          amount,
          ...(reference === "" ? {} : { reference }),
          ...(source_id === "" ? {} : { source_id }),
        },
      });
    }
  }
  return errors.length > 0 ? err(errors) : ok(rows);
}

function rawValues(header: readonly string[], record: CsvRecord): Record<string, string> {
  const raw: Record<string, string> = {};
  header.forEach((name, position) => {
    raw[name === "" ? `column ${position + 1}` : name] = record.cells[position] ?? "";
  });
  return raw;
}

export function describeRowError(error: RowError): string {
  return `Row ${error.row} (line ${error.line})${error.column === undefined ? "" : `, column '${error.column}'`}: ${error.message}`;
}

export function signedDisplay(values: SourceValues): string {
  return `${values.source_movement === "outflow" ? "-" : "+"}${formatPence(values.amount).replace("-", "")}`;
}

