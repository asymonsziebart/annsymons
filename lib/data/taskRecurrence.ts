/**
 * Task due-date recurrence (local calendar YYYY-MM-DD).
 * Yearly uses recurrence_month for the 1st of that month; daily/weekly/monthly advance from the current due date.
 * Safe for client and server.
 */

import {
  TASK_RECURRENCE_INTERVALS,
  type TaskRecurrenceInterval,
  type TaskRow,
} from "./taskClientTypes";

export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoLocal(iso: string, refFallback: Date): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return new Date(refFallback);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  return new Date(y, mo - 1, da);
}

/** Add calendar days to an ISO date (local). If `iso` is missing/invalid, starts from `ref`’s calendar day. */
export function addDaysLocal(iso: string | null, days: number, ref = new Date()): string {
  const base =
    iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : toIsoDateLocal(ref);
  const dt = parseIsoLocal(base, ref);
  dt.setDate(dt.getDate() + days);
  return toIsoDateLocal(dt);
}

/** Add calendar months to an ISO date (local). If `iso` is missing/invalid, starts from `ref`’s calendar day. */
export function addMonthsLocal(iso: string | null, months: number, ref = new Date()): string {
  const base =
    iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : toIsoDateLocal(ref);
  const dt = parseIsoLocal(base, ref);
  dt.setMonth(dt.getMonth() + months);
  return toIsoDateLocal(dt);
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

export function isRecurrenceIntervalString(s: unknown): s is TaskRecurrenceInterval {
  return typeof s === "string" && (TASK_RECURRENCE_INTERVALS as readonly string[]).includes(s.trim());
}

/**
 * Canonical repeat fields: yearly requires a month; non-yearly clears month.
 * Legacy: recurrence_month set without interval → yearly.
 */
export function normalizeRecurrenceFields(args: {
  recurrence_interval?: string | null;
  recurrence_month?: number | null;
}): { recurrence_interval: string | null; recurrence_month: number | null } {
  const raw = args.recurrence_interval;
  let interval: string | null =
    raw == null || raw === "" ? null : String(raw).trim();
  if (interval && !isRecurrenceIntervalString(interval)) interval = null;
  let month =
    args.recurrence_month != null && isValidRecurrenceMonth(args.recurrence_month)
      ? args.recurrence_month
      : null;
  if (!interval && month != null) interval = "yearly";
  if (interval && interval !== "yearly") month = null;
  if (interval === "yearly" && month == null) interval = null;
  return { recurrence_interval: interval, recurrence_month: month };
}

export function effectiveRecurrenceInterval(
  task: Pick<TaskRow, "recurrence_interval" | "recurrence_month">
): TaskRecurrenceInterval | null {
  const { recurrence_interval } = normalizeRecurrenceFields({
    recurrence_interval: task.recurrence_interval,
    recurrence_month: task.recurrence_month,
  });
  return recurrence_interval as TaskRecurrenceInterval | null;
}

export function advanceRecurringDueAfterComplete(
  dueDate: string | null,
  task: Pick<TaskRow, "recurrence_interval" | "recurrence_month">,
  ref = new Date()
): string | null {
  const iv = effectiveRecurrenceInterval(task);
  if (iv == null) return null;
  const m = task.recurrence_month;
  switch (iv) {
    case "daily":
      return addDaysLocal(dueDate, 1, ref);
    case "weekly":
      return addDaysLocal(dueDate, 7, ref);
    case "monthly":
      return addMonthsLocal(dueDate, 1, ref);
    case "yearly":
      if (m == null || !isValidRecurrenceMonth(m)) return null;
      return advanceYearlyRecurringDueAfterComplete(dueDate, m, ref);
    default:
      return null;
  }
}

/**
 * Open yearly recurring tasks whose due date falls in a later calendar year than `ref`
 * are omitted from the main list (e.g. after completing May 2026, the May 2027 row stays
 * hidden until the calendar year of that due date). Search can still surface them by title.
 */
export function isYearlyRecurringSuppressedUntilDueYear(
  task: Pick<TaskRow, "recurrence_interval" | "recurrence_month" | "status" | "due_date">,
  ref = new Date()
): boolean {
  if (effectiveRecurrenceInterval(task) !== "yearly") return false;
  if (task.status === "done" || task.status === "cancelled") return false;
  const d = task.due_date?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const dueYear = parseInt(d.slice(0, 4), 10);
  if (!Number.isFinite(dueYear)) return false;
  return dueYear > ref.getFullYear();
}
