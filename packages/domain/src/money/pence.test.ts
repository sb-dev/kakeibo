import { describe, expect, it } from "vitest";
import { MoneyRangeError } from "../errors.ts";
import { addPence, formatPence, formatPencePlain, parseMoney, pence, subPence, sumPence } from "./pence.ts";

function parsed(text: string): number {
  const result = parseMoney(text);
  if (!result.ok) {
    throw new Error(`expected ${text} to parse, got ${result.error.code}`);
  }
  return result.value;
}

function rejected(text: string): string {
  const result = parseMoney(text);
  if (result.ok) {
    throw new Error(`expected ${text} to be rejected`);
  }
  return result.error.code;
}

describe("parseMoney", () => {
  it("parses whole pounds, pence, thousands separators and a pound sign exactly", () => {
    expect(parsed("500")).toBe(50000);
    expect(parsed("£1,234.56")).toBe(123456);
    expect(parsed("0.5")).toBe(50);
    expect(parsed("0.05")).toBe(5);
    expect(parsed(" 12.30 ")).toBe(1230);
  });

  it("parses negative amounts", () => {
    expect(parsed("-10.00")).toBe(-1000);
    expect(parsed("-£0.01")).toBe(-1);
  });

  it("rejects more than two decimal places", () => {
    expect(rejected("1.005")).toBe("excess_precision");
    expect(rejected("0.001")).toBe("excess_precision");
  });

  it("rejects empty and malformed text", () => {
    expect(rejected("")).toBe("empty");
    expect(rejected("   ")).toBe("empty");
    expect(rejected("abc")).toBe("invalid_format");
    expect(rejected("1,2345")).toBe("invalid_format");
    expect(rejected("1e3")).toBe("invalid_format");
    expect(rejected("$5")).toBe("invalid_format");
    expect(rejected("5.")).toBe("invalid_format");
  });

  it("rejects values beyond the safe integer range", () => {
    expect(rejected("90071992547409.92")).toBe("unsafe_integer");
    expect(rejected("99999999999999999")).toBe("unsafe_integer");
    expect(parsed("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("checked arithmetic", () => {
  it("adds and subtracts exactly", () => {
    expect(addPence(pence(123), pence(877))).toBe(1000);
    expect(subPence(pence(1000), pence(1001))).toBe(-1);
    expect(sumPence([pence(15000), pence(10000), pence(2500), pence(2500)])).toBe(30000);
    expect(sumPence([])).toBe(0);
  });

  it("throws MoneyRangeError when a result leaves the safe range", () => {
    const max = pence(Number.MAX_SAFE_INTEGER);
    expect(() => addPence(max, pence(1))).toThrow(MoneyRangeError);
    expect(() => subPence(pence(-Number.MAX_SAFE_INTEGER), pence(2))).toThrow(MoneyRangeError);
    expect(() => pence(1.5)).toThrow(MoneyRangeError);
  });
});

describe("formatPence", () => {
  it("renders pence, thousands and negatives", () => {
    expect(formatPence(pence(0))).toBe("£0.00");
    expect(formatPence(pence(5))).toBe("£0.05");
    expect(formatPence(pence(50000))).toBe("£500.00");
    expect(formatPence(pence(123456789))).toBe("£1,234,567.89");
    expect(formatPence(pence(-1000))).toBe("-£10.00");
  });

  it("stays exact at the top of the safe integer range", () => {
    expect(formatPence(pence(Number.MAX_SAFE_INTEGER))).toBe("£90,071,992,547,409.91");
    expect(formatPence(pence(9007199254740990))).toBe("£90,071,992,547,409.90");
    expect(formatPence(pence(9007199254740900))).toBe("£90,071,992,547,409.00");
  });
});

describe("formatPencePlain", () => {
  it("renders plain decimal pounds that parse back to the same pence", () => {
    expect(formatPencePlain(pence(0))).toBe("0.00");
    expect(formatPencePlain(pence(5))).toBe("0.05");
    expect(formatPencePlain(pence(50000))).toBe("500.00");
    expect(formatPencePlain(pence(-1000))).toBe("-10.00");
    expect(formatPencePlain(pence(9007199254740990))).toBe("90071992547409.90");
    for (const value of [0, 1, 99, 100, 123456789, 9007199254740900, 9007199254740990, Number.MAX_SAFE_INTEGER]) {
      expect(parseMoney(formatPencePlain(pence(value)))).toEqual({ ok: true, value });
    }
  });
});
