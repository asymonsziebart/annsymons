/**
 * Yearly recurrence on the 1st of a calendar month (local calendar YYYY-MM-DD).
 * Safe for client and server.
 */

import type { TaskRow } from "./taskClientTypes";

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Next YYYY-MM-01 for `month` (1–12) on or after today's calendar date. */
export function nextYearlyFirstOfMonthDue(month: number, ref = new Date()): string {
  const y = ref.getFullYear();
  const thisYearFirst = new Date(y, month - 1, 1);
  const startOfRef = new Date(y, ref.getMonth(), ref.getDate());
  if (thisYearFirst >= startOfRef) {
    return toIsoDateLocal(thisYearFirst);
  }
  return toIsoDateLocal(new Date(y + 1, month - 1, 1));
}

/** 1st of `month` in the same calendar year as `ref` (local). Used for yearly checklist-style dues. */
export function yearlyMonthFirstInCurrentYear(month: number, ref = new Date()): string {
  const y = ref.getFullYear();
  const mm = String(month).padStart(2, "0");
  return `${y}-${mm}-01`;
}

/**
 * After completing a yearly month-1st task: next due is the 1st of that month in the following
 * calendar year of the current due, but never more than one year past "today" (stops runaway
 * years from double-submits or bad data).
 */
export function advanceYearlyRecurringDueAfterComplete(
  dueDate: string | null,
  month: number,
  ref = new Date()
): string {
  const mm = String(month).padStart(2, "0");
  const capYear = ref.getFullYear() + 1;
  if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    const y = parseInt(dueDate.slice(0, 4), 10);
    if (Number.isFinite(y)) {
      const nextYear = Math.min(y + 1, capYear);
      return `${nextYear}-${mm}-01`;
    }
  }
  return nextYearlyFirstOfMonthDue(month, ref);
}

export function isValidRecurrenceMonth(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 12;
}

/**
 * Open yearly recurring tasks whose due date falls in a later calendar year than `ref`
 * are omitted from the main list (e.g. after completing May 2026, the May 2027 row stays
 * hidden until the calendar year of that due date). Search can still surface them by title.
 */
export function isYearlyRecurringSuppressedUntilDueYear(
  task: Pick<TaskRow, "recurrence_month" | "status" | "due_date">,
  ref = new Date()
): boolean {
  if (task.recurrence_month == null || !isValidRecurrenceMonth(task.recurrence_month)) {
    return false;
  }
  if (task.status === "done" || task.status === "cancelled") return false;
  const d = task.due_date?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const dueYear = parseInt(d.slice(0, 4), 10);
  if (!Number.isFinite(dueYear)) return false;
  return dueYear > ref.getFullYear();
}
