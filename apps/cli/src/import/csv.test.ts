import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CsvFormatError, decodeCsv, guessDelimiter, parseCsv, readCsvFile } from "./csv.ts";
import { describeRowError, mappingsCompatible, missingColumns, normaliseRows, sameSettings, type MappingSettings } from "./mapping.ts";

const FIXTURES = fileURLToPath(new URL("../../../../fixtures/synthetic-financial-data/csv/", import.meta.url));

function settings(overrides: Partial<MappingSettings> = {}): MappingSettings {
  return {
    delimiter: ",",
    header: ["Date", "Description", "Amount"],
    date_column: "Date",
    date_format: "YYYY-MM-DD",
    description_column: "Description",
    amount: { kind: "signed", column: "Amount", money_out_sign: "negative" },
    normalisation_version: 1,
    ...overrides,
  };
}

function csvOf(text: string, delimiter: "," | ";" = ",") {
  return parseCsv(decodeCsv("test.csv", new TextEncoder().encode(text)), delimiter);
}

function rowsOf(text: string, mapping: MappingSettings = settings()) {
  const result = normaliseRows(mapping, csvOf(text, mapping.delimiter));
  if (!result.ok) throw new Error(result.error.map(describeRowError).join("\n"));
  return result.value;
}

function errorsOf(text: string, mapping: MappingSettings = settings()) {
  const result = normaliseRows(mapping, csvOf(text, mapping.delimiter));
  if (result.ok) throw new Error("expected errors");
  return result.error.map(describeRowError);
}

describe("CSV parsing", () => {
  it("reads quoted fields, escaped quotes, blank lines and a byte-order mark", async () => {
    const file = await readCsvFile(`${FIXTURES}current-account-signed.csv`);
    expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
    const csv = parseCsv(file, ",");
    expect(csv.header).toEqual(["Date", "Description", "Amount", "Balance"]);
    expect(csv.records.map((record) => record.cells[1])).toEqual([
      "Salary ACME LTD",
      "Tesco Stores, Leeds",
      'Waterstones "Books"',
      "Transfer to savings",
      "Tesco refund",
    ]);
    expect(csv.records.map((record) => [record.row, record.line])).toEqual([
      [1, 2],
      [2, 3],
      [3, 5],
      [4, 6],
      [5, 7],
    ]);
    const withBom = decodeCsv("bom.csv", new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Date,Description,Amount\n2026-10-01,A,-1\n")]));
    expect(parseCsv(withBom, ",").header[0]).toBe("Date");
  });

  it("guesses comma and semicolon delimiters from the header", () => {
    expect(guessDelimiter("Date,Description,Amount\n")).toBe(",");
    expect(guessDelimiter("\nTransaction date;Merchant;Amount;Currency\n")).toBe(";");
    expect(guessDelimiter('"a;b",c\n')).toBe(",");
  });

  it("rejects invalid UTF-8, inconsistent field counts, unclosed quotes, duplicate headers and empty files", () => {
    expect(() => decodeCsv("bad.csv", new Uint8Array([0x44, 0xff, 0x0a]))).toThrow(/not valid UTF-8/);
    expect(() => csvOf("Date,Description,Amount\n2026-10-01,A,-1,extra\n")).toThrow(/line 2/);
    expect(() => csvOf('Date,Description,Amount\n2026-10-01,"A,-1\n')).toThrow(CsvFormatError);
    expect(() => csvOf("Date,Date,Amount\n2026-10-01,A,-1\n")).toThrow(/more than one column named 'Date'/);
    expect(() => csvOf("")).toThrow(/is empty/);
    expect(() => csvOf("Date,Description,Amount\n\n")).toThrow(/no transactions/);
  });
});

describe("row normalisation", () => {
  it("maps a signed bank export where negative is money out", async () => {
    const csv = parseCsv(await readCsvFile(`${FIXTURES}current-account-signed.csv`), ",");
    const result = normaliseRows(settings({ header: csv.header }), csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((row) => [row.values.source_movement, row.values.amount])).toEqual([
      ["inflow", 150000],
      ["outflow", 5000],
      ["outflow", 2000],
      ["outflow", 20000],
      ["inflow", 1000],
    ]);
    expect(result.value[1]?.raw).toEqual({ Date: "2026-10-02", Description: "Tesco Stores, Leeds", Amount: "-50.00", Balance: "1550.00" });
  });

  it("maps a semicolon card export where positive is money out, with DD/MM/YYYY dates and a currency column", async () => {
    const csv = parseCsv(await readCsvFile(`${FIXTURES}credit-card-positive-out.csv`), ";");
    const mapping = settings({
      delimiter: ";",
      header: csv.header,
      date_column: "Transaction date",
      date_format: "DD/MM/YYYY",
      description_column: "Merchant",
      amount: { kind: "signed", column: "Amount", money_out_sign: "positive" },
      currency_column: "Currency",
    });
    const result = normaliseRows(mapping, csv);
    expect(result.ok && result.value.map((row) => [row.values.posted_date, row.values.description, row.values.source_movement, row.values.amount])).toEqual([
      ["2026-10-04", "Corner Cafe", "outflow", 320],
      ["2026-10-05", "Bookshop; second-hand", "outflow", 1299],
      ["2026-10-07", "Payment received - thank you", "inflow", 15000],
    ]);
  });

  it("maps separate debit and credit columns, treating blank and zero as no amount", async () => {
    const csv = parseCsv(await readCsvFile(`${FIXTURES}debit-credit.csv`), ",");
    const mapping = settings({
      header: csv.header,
      date_format: "DD/MM/YYYY",
      description_column: "Details",
      amount: { kind: "debit_credit", debit_column: "Paid out", credit_column: "Paid in" },
    });
    const result = normaliseRows(mapping, csv);
    expect(result.ok && result.value.map((row) => [row.values.source_movement, row.values.amount])).toEqual([
      ["outflow", 65000],
      ["inflow", 1500],
      ["outflow", 175],
    ]);
  });

  it("keeps optional source IDs and references and collapses description whitespace", () => {
    const [row] = rowsOf("Id,Date,Description,Amount,Ref\n T-1 ,2026-10-01,\"  Gym   membership \",-30.00, R 1 \n", {
      ...settings({ header: ["Id", "Date", "Description", "Amount", "Ref"] }),
      source_id_column: "Id",
      reference_column: "Ref",
    });
    expect(row?.values).toEqual({
      posted_date: "2026-10-01",
      description: "Gym membership",
      currency: "GBP",
      source_movement: "outflow",
      amount: 3000,
      reference: "R 1",
      source_id: "T-1",
    });
  });

  it("validates the whole file and names every invalid row and field", async () => {
    const csv = parseCsv(await readCsvFile(`${FIXTURES}invalid-rows.csv`), ",");
    const result = normaliseRows(settings(), csv);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.map(describeRowError)).toEqual([
      "Row 2 (line 3), column 'Date': '2026-02-30' is not a valid YYYY-MM-DD date",
      "Row 3 (line 4), column 'Amount': '-1.005' has more than two decimal places",
      "Row 4 (line 5), column 'Description': description is empty",
      "Row 5 (line 6), column 'Amount': 'abc' is not an amount; use a decimal point, for example -12.50",
    ]);
  });

  it("rejects wrong date formats, decimal commas, zero, unsafe amounts and debit/credit misuse", () => {
    expect(errorsOf("Date,Description,Amount\n01/10/2026,A,-1\n2026-10-01,B,\"-1,50\"\n2026-10-01,C,0.00\n2026-10-01,D,99999999999999999\n")).toEqual([
      "Row 1 (line 2), column 'Date': '01/10/2026' is not a valid YYYY-MM-DD date",
      "Row 2 (line 3), column 'Amount': '-1,50' is not an amount; use a decimal point, for example -12.50",
      "Row 3 (line 4), column 'Amount': amount is zero, so its direction is unknown",
      "Row 4 (line 5), column 'Amount': '99999999999999999' is too large to store exactly",
    ]);
    expect(errorsOf("Date,Description,Amount\n2026-10-01,A,-1\n", settings({ date_format: "DD/MM/YYYY" }))).toEqual([
      "Row 1 (line 2), column 'Date': '2026-10-01' is not a valid DD/MM/YYYY date",
    ]);
    const debitCredit = settings({ amount: { kind: "debit_credit", debit_column: "Out", credit_column: "In" } });
    expect(errorsOf("Date,Description,Out,In\n2026-10-01,A,1.00,2.00\n2026-10-01,B,,\n2026-10-01,C,-1.00,\n", debitCredit)).toEqual([
      "Row 1 (line 2): both 'Out' and 'In' have amounts",
      "Row 2 (line 3): neither 'Out' nor 'In' has an amount",
      "Row 3 (line 4), column 'Out': debit amounts must not be negative",
    ]);
  });

  it("rejects currencies other than GBP and source IDs repeated within the file", async () => {
    const csv = parseCsv(await readCsvFile(`${FIXTURES}non-gbp.csv`), ",");
    const result = normaliseRows(settings({ currency_column: "Currency" }), csv);
    expect(!result.ok && result.error.map(describeRowError)).toEqual([
      "Row 1 (line 2), column 'Currency': currency 'EUR' is not supported; this release imports GBP only",
    ]);
    expect(errorsOf("Id,Date,Description,Amount\nT-1,2026-10-01,A,-1\nT-1,2026-10-02,B,-2\n", settings({ source_id_column: "Id" }))).toEqual([
      "Row 2 (line 3), column 'Id': source ID 'T-1' already appears on row 1",
    ]);
  });
});

describe("mapping comparison", () => {
  it("reports mapped columns missing from a later file", () => {
    expect(missingColumns(settings({ currency_column: "Currency" }), ["Date", "Description", "Value"])).toEqual(["Amount", "Currency"]);
  });

  it("treats header-only changes as compatible but changed conventions as incompatible", () => {
    const base = settings();
    expect(mappingsCompatible(base, settings({ header: ["Date", "Description", "Amount", "Balance"] }))).toBe(true);
    expect(mappingsCompatible(base, settings({ date_format: "DD/MM/YYYY" }))).toBe(false);
    expect(mappingsCompatible(base, settings({ description_column: "Narrative" }))).toBe(false);
    expect(mappingsCompatible(base, settings({ amount: { kind: "signed", column: "Amount", money_out_sign: "positive" } }))).toBe(false);
    expect(mappingsCompatible(base, settings({ source_id_column: "Id" }))).toBe(false);
    expect(sameSettings(base, settings())).toBe(true);
    expect(sameSettings(base, settings({ header: ["Date", "Description", "Amount", "Balance"] }))).toBe(false);
  });
});
