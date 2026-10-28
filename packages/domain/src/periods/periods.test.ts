import { describe, expect, it } from "vitest";
import {
  currentDate,
  currentMonth,
  monthOf,
  parseIsoDate,
  parseMonth,
  parseWeekStart,
  weekStartOf,
  type IsoDate,
} from "./periods.ts";

describe("parseMonth", () => {
  it("accepts YYYY-MM", () => {
    expect(parseMonth("2026-10")).toEqual({ ok: true, value: "2026-10" });
    expect(parseMonth("2026-01")).toEqual({ ok: true, value: "2026-01" });
  });

  it("rejects other shapes", () => {
    for (const input of ["2026-13", "2026-00", "2026-1", "October", "2026/10", "2026-10-01", ""]) {
      const result = parseMonth(input);
      expect(result.ok, input).toBe(false);
    }
  });
});

describe("currentMonth and currentDate", () => {
  it("use the local calendar, including the year boundary", () => {
    expect(currentMonth(new Date(2026, 11, 31, 23, 59))).toBe("2026-12");
    expect(currentMonth(new Date(2027, 0, 1, 0, 0))).toBe("2027-01");
    expect(currentDate(new Date(2026, 9, 28, 12))).toBe("2026-10-28");
  });
});

describe("parseIsoDate", () => {
  it("accepts real calendar dates", () => {
    expect(parseIsoDate("2024-02-29").ok).toBe(true);
    expect(parseIsoDate("2026-12-31").ok).toBe(true);
  });

  it("rejects impossible dates", () => {
    for (const input of ["2026-02-30", "2026-02-29", "2026-04-31", "2026-13-01", "2026-10-00", "2026-10-1"]) {
      expect(parseIsoDate(input).ok, input).toBe(false);
    }
  });
});

describe("weeks", () => {
  it("accepts a Monday as an explicit week start", () => {
    expect(parseWeekStart("2026-10-19")).toEqual({ ok: true, value: "2026-10-19" });
  });

  it("rejects a Sunday and other days", () => {
    expect(parseWeekStart("2026-10-18")).toEqual({ ok: false, error: { code: "not_monday", input: "2026-10-18" } });
    expect(parseWeekStart("2026-10-20").ok).toBe(false);
  });

  it("finds the Monday on or before a date, across month and year boundaries", () => {
    expect(weekStartOf("2026-10-19" as IsoDate)).toBe("2026-10-19");
    expect(weekStartOf("2026-10-25" as IsoDate)).toBe("2026-10-19");
    expect(weekStartOf("2026-11-01" as IsoDate)).toBe("2026-10-26");
    expect(weekStartOf("2027-01-03" as IsoDate)).toBe("2026-12-28");
  });

  it("maps a date to its month", () => {
    expect(monthOf("2026-11-01" as IsoDate)).toBe("2026-11");
  });
});
