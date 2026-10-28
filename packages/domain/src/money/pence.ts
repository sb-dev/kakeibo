import { MoneyRangeError } from "../errors.ts";
import { err, ok, type Result } from "../result.ts";

/** Integer pence. The brand prevents accidental mixing with unchecked numbers. */
export type Pence = number & { readonly __brand: "Pence" };

export type MoneyParseError = {
  readonly code: "empty" | "invalid_format" | "excess_precision" | "unsafe_integer";
  readonly input: string;
};

const MONEY_PATTERN = /^(-)?£?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;

/** Checked constructor: throws when the number is not a safe integer. */
export function pence(value: number): Pence {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyRangeError(`Amount ${String(value)} is not a safe integer number of pence`);
  }
  return value as Pence;
}

export function isPence(value: unknown): value is Pence {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Parse decimal text such as "500", "£1,234.56", "0.5" or "-10.00" into exact pence.
 * Rejects more than two decimal places and values outside the safe integer range.
 * Never uses floating-point arithmetic.
 */
export function parseMoney(text: string): Result<Pence, MoneyParseError> {
  const input = text.trim();
  if (input === "") {
    return err({ code: "empty", input: text });
  }
  const match = MONEY_PATTERN.exec(input);
  if (match === null) {
    return err({ code: "invalid_format", input: text });
  }
  const negative = match[1] === "-";
  const wholeText = (match[2] ?? "0").replaceAll(",", "");
  const fractionText = match[3] ?? "";
  if (fractionText.length > 2) {
    return err({ code: "excess_precision", input: text });
  }
  const fractionPence = Number.parseInt(fractionText.padEnd(2, "0"), 10);
  // Use BigInt to detect overflow before converting to a number.
  const wholeBig = BigInt(wholeText);
  const totalBig = wholeBig * 100n + BigInt(fractionPence);
  if (totalBig > BigInt(Number.MAX_SAFE_INTEGER)) {
    return err({ code: "unsafe_integer", input: text });
  }
  const magnitude = Number(totalBig);
  return ok((negative ? -magnitude : magnitude) as Pence);
}

export function addPence(a: Pence, b: Pence): Pence {
  return pence(a + b);
}

export function subPence(a: Pence, b: Pence): Pence {
  return pence(a - b);
}

export function sumPence(values: readonly Pence[]): Pence {
  let total = pence(0);
  for (const value of values) {
    total = addPence(total, value);
  }
  return total;
}

export function negatePence(value: Pence): Pence {
  return pence(-value);
}

/** Render pence as "£1,234.56" or "-£10.00". Hand-rolled so output is stable across locales. */
export function formatPence(value: Pence): string {
  const negative = value < 0;
  const magnitude = Math.abs(value);
  const whole = Math.floor(magnitude / 100);
  const fraction = magnitude % 100;
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}£${wholeText}.${fraction.toString().padStart(2, "0")}`;
}
