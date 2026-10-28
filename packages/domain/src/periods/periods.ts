import { err, ok, type Result } from "../result.ts";

/** Calendar month "YYYY-MM". */
export type Month = string & { readonly __brand: "Month" };
/** Calendar date "YYYY-MM-DD" with no timezone. */
export type IsoDate = string & { readonly __brand: "IsoDate" };

export type PeriodError = {
  readonly code: "invalid_month" | "invalid_date" | "not_monday";
  readonly input: string;
};

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this month. UTC avoids DST effects.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseMonth(text: string): Result<Month, PeriodError> {
  const match = MONTH_PATTERN.exec(text.trim());
  if (match === null) {
    return err({ code: "invalid_month", input: text });
  }
  const month = Number.parseInt(match[2] ?? "", 10);
  if (month < 1 || month > 12) {
    return err({ code: "invalid_month", input: text });
  }
  return ok(`${match[1]}-${match[2]}` as Month);
}

/** The local calendar month of the given instant. */
export function currentMonth(now: Date): Month {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}` as Month;
}

export function parseIsoDate(text: string): Result<IsoDate, PeriodError> {
  const match = DATE_PATTERN.exec(text.trim());
  if (match === null) {
    return err({ code: "invalid_date", input: text });
  }
  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  const day = Number.parseInt(match[3] ?? "", 10);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return err({ code: "invalid_date", input: text });
  }
  return ok(`${match[1]}-${match[2]}-${match[3]}` as IsoDate);
}

/** The local calendar date of the given instant. */
export function currentDate(now: Date): IsoDate {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}` as IsoDate;
}

/** 0 = Sunday … 6 = Saturday, computed from the calendar date alone. */
export function dayOfWeek(date: IsoDate): number {
  const [year, month, day] = date.split("-").map((part) => Number.parseInt(part, 10)) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The month that contains a calendar date. */
export function monthOf(date: IsoDate): Month {
  return date.slice(0, 7) as Month;
}

/** Parse an explicit week start. Weeks run Monday to Sunday, so the date must be a Monday. */
export function parseWeekStart(text: string): Result<IsoDate, PeriodError> {
  const date = parseIsoDate(text);
  if (!date.ok) {
    return date;
  }
  if (dayOfWeek(date.value) !== 1) {
    return err({ code: "not_monday", input: text });
  }
  return date;
}

/** The Monday on or before the given calendar date. */
export function weekStartOf(date: IsoDate): IsoDate {
  const [year, month, day] = date.split("-").map((part) => Number.parseInt(part, 10)) as [number, number, number];
  const utc = new Date(Date.UTC(year, month - 1, day));
  const offset = (utc.getUTCDay() + 6) % 7; // Monday → 0, Sunday → 6
  utc.setUTCDate(utc.getUTCDate() - offset);
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}` as IsoDate;
}
