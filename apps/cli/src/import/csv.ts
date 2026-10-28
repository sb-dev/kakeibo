import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { CsvError, parse } from "csv-parse/sync";
import type { CsvDelimiter } from "@kakeibo/domain";
import { CliError } from "../errors.ts";

export type CsvFile = {
  readonly name: string;
  readonly sha256: string;
  /** Decoded UTF-8 text without a byte-order mark. */
  readonly text: string;
};

/** A parsed data row: its 1-based position after the header and the physical line where it ends. */
export type CsvRecord = {
  readonly row: number;
  readonly line: number;
  readonly cells: readonly string[];
};

export type ParsedCsv = {
  readonly header: readonly string[];
  readonly records: readonly CsvRecord[];
};

export class CsvFormatError extends CliError {}

/** Read the file, hash its exact bytes and decode strict UTF-8 (PRD §4.1). */
export async function readCsvFile(file: string): Promise<CsvFile> {
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(file);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CliError(`Cannot read ${file}: ${reason}.`);
  }
  return decodeCsv(path.basename(file), bytes);
}

export function decodeCsv(name: string, bytes: Uint8Array): CsvFile {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CsvFormatError(`${name} is not valid UTF-8 text. Export the file as UTF-8 CSV.`);
  }
  if (text.startsWith("﻿")) {
    text = text.slice(1);
  }
  return { name, sha256: createHash("sha256").update(bytes).digest("hex"), text };
}

/** The delimiter that splits the first non-blank line into more fields, preferring a comma on a tie. */
export function guessDelimiter(text: string): CsvDelimiter {
  const first = text.split(/\r?\n/).find((line) => line.trim() !== "") ?? "";
  const count = (delimiter: string): number => {
    let fields = 0;
    let quoted = false;
    for (const char of first) {
      if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) fields += 1;
    }
    return fields;
  };
  return count(";") > count(",") ? ";" : ",";
}

/**
 * Parse with a header row, quoted fields and blank lines (PRD §4.1). Rows whose cells are all empty
 * count as blank. A malformed file is rejected with the line that failed.
 */
export function parseCsv(file: CsvFile, delimiter: CsvDelimiter): ParsedCsv {
  let parsed: { record: string[]; info: { lines: number } }[];
  try {
    parsed = parse(file.text, {
      delimiter,
      info: true,
      skip_empty_lines: true,
      skip_records_with_empty_values: true,
    }) as unknown as { record: string[]; info: { lines: number } }[];
  } catch (error) {
    if (error instanceof CsvError) {
      throw new CsvFormatError(`${file.name} is not a valid CSV file with '${delimiter}' delimiters: ${error.message}.`);
    }
    throw error;
  }
  const [first, ...rest] = parsed;
  if (first === undefined) {
    throw new CsvFormatError(`${file.name} is empty. Expected a header row followed by transactions.`);
  }
  const header = first.record.map((name) => name.trim());
  const seen = new Set<string>();
  for (const name of header) {
    if (name !== "" && seen.has(name)) {
      throw new CsvFormatError(`${file.name} has more than one column named '${name}'. Column names must be unique.`);
    }
    seen.add(name);
  }
  if (rest.length === 0) {
    throw new CsvFormatError(`${file.name} has a header row but no transactions.`);
  }
  return {
    header,
    records: rest.map((entry, index) => ({ row: index + 1, line: entry.info.lines, cells: entry.record })),
  };
}
