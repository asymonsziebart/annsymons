/**
 * Yearly recurrence on the 1st of a calendar month (local calendar YYYY-MM-DD).
 * Safe for client and server.
 */

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

/** After completing a yearly month-1st task: next due is same month, following year, on the 1st. */
export function advanceYearlyRecurringDueAfterComplete(
  dueDate: string | null,
  month: number
): string {
  const mm = String(month).padStart(2, "0");
  if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    const y = parseInt(dueDate.slice(0, 4), 10);
    if (Number.isFinite(y)) return `${y + 1}-${mm}-01`;
  }
  return nextYearlyFirstOfMonthDue(month, new Date());
}

export function isValidRecurrenceMonth(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 12;
}
