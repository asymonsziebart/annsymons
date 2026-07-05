import {
  isTaskOverdue,
  TASK_PRIORITIES,
  type TaskRow,
} from "@/lib/data/taskClientTypes";
import { isYearlyRecurringSuppressedUntilDueYear } from "@/lib/data/taskRecurrence";

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isOpenTask(task: TaskRow): boolean {
  return task.status !== "done" && task.status !== "cancelled";
}

/** Open tasks that are overdue or due today — same rules as the tasks calendar. */
export function getDueTasksForMirror(tasks: TaskRow[], ref = new Date()): TaskRow[] {
  const todayIso = toIsoDateLocal(ref);

  const due = tasks.filter((t) => {
    if (!isOpenTask(t)) return false;
    if (isYearlyRecurringSuppressedUntilDueYear(t, ref)) return false;

    const duRaw = t.due_date?.trim() ?? "";
    if (duRaw && /^\d{4}-\d{2}-\d{2}$/.test(duRaw)) {
      return duRaw <= todayIso;
    }
    return isTaskOverdue(t);
  });

  due.sort((a, b) => {
    const aOverdue = a.due_date && a.due_date < todayIso ? 0 : 1;
    const bOverdue = b.due_date && b.due_date < todayIso ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;

    const pa = TASK_PRIORITIES.indexOf(a.priority);
    const pb = TASK_PRIORITIES.indexOf(b.priority);
    if (pa !== pb) return pa - pb;

    return (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" });
  });

  return due;
}

export function formatMirrorDueLabel(task: TaskRow, ref = new Date()): string {
  const todayIso = toIsoDateLocal(ref);
  const duRaw = task.due_date?.trim() ?? "";

  if (duRaw && /^\d{4}-\d{2}-\d{2}$/.test(duRaw)) {
    if (duRaw < todayIso) return "Overdue";
    if (duRaw === todayIso) return "Due today";
    const d = new Date(`${duRaw}T12:00:00`);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  if (isTaskOverdue(task)) return "Overdue";
  return "Due";
}
