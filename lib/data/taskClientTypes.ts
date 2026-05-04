/**
 * All task types, labels, and pure helpers for UI + API.
 * Safe for Client Components — no @/lib/db. Import ONLY from this file in "use client" modules.
 */

export type TaskSectionRow = {
  id: number;
  name: string;
  color_key: string;
  sort_order: number;
  created_at: string;
};

export type SubtaskRow = {
  id: number;
  task_id: number;
  title: string;
  done: boolean;
  sort_order: number;
  created_at: string;
};

export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export const TASK_RECURRENCE_INTERVALS = ["daily", "weekly", "monthly", "yearly"] as const;
export type TaskRecurrenceInterval = (typeof TASK_RECURRENCE_INTERVALS)[number];

export const TASK_PRIORITIES = ["none", "high", "medium", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "—",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function isTaskStatus(s: string): s is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(s);
}

export function normalizeTaskStatus(s: string): TaskStatus {
  return isTaskStatus(s) ? s : "todo";
}

export function isTaskPriority(s: string): s is TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(s);
}

export function normalizeTaskPriority(s: string): TaskPriority {
  return isTaskPriority(s) ? s : "none";
}

/**
 * Best-effort: map a section *name* to a task priority (e.g. "High Priority (3)" → high).
 * Returns null if the name does not suggest a level.
 */
export function priorityInferredFromSectionName(sectionName: string): TaskPriority | null {
  const t = sectionName.toLowerCase();
  if (/\bhighlight\b/.test(t) && !/\bhigh[-\s]*priority\b|high[-\s]*pri/.test(t)) {
    return null;
  }
  if (
    /\bhigh[-\s]*priority\b|high-priority|highest|urgent|critical|asap|\bp0\b|sev[-\s]*0/.test(t) ||
    (t.includes("high") && t.includes("priority") && !t.includes("low"))
  ) {
    return "high";
  }
  if (
    /\blow[-\s]*priority\b|low-priority|lowest|icebox|someday/.test(t) ||
    (t.includes("low") && t.includes("priority") && !t.includes("high"))
  ) {
    return "low";
  }
  if (/\bmed(?:ium|\.?)\b|normal|standard|p1\b|soon/.test(t) || (t.includes("medium") && t.includes("priority"))) {
    return "medium";
  }
  return null;
}

export type TaskRow = {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskStatus;
  sort_order: number;
  created_at: string;
  last_overdue_email_at?: string | null;
  section_id: number;
  section_name: string;
  assignee: string | null;
  priority: TaskPriority;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  dependencies: string | null;
  /** Task IDs that must be done (or cancelled) before this task can be completed. */
  depends_on_task_ids: number[];
  /** daily | weekly | monthly | yearly — completing rolls due_date forward. */
  recurrence_interval: string | null;
  /** For yearly: 1–12 = due on the 1st of that month each year. Null for other intervals. */
  recurrence_month: number | null;
  requester: string | null;
  quarter: string | null;
  project_label: string | null;
  subtask_count: number;
};

export type TaskPatch = Partial<
  Pick<
    TaskRow,
    | "title"
    | "description"
    | "due_date"
    | "status"
    | "section_id"
    | "assignee"
    | "priority"
    | "estimated_minutes"
    | "actual_minutes"
    | "dependencies"
    | "depends_on_task_ids"
    | "recurrence_interval"
    | "recurrence_month"
    | "requester"
    | "quarter"
    | "project_label"
  >
>;

export type CreateTaskInput = {
  title: string;
  section_id: number;
  description?: string | null;
  due_date?: string | null;
  status?: TaskStatus;
  assignee?: string | null;
  priority?: TaskPriority;
  estimated_minutes?: number | null;
  actual_minutes?: number | null;
  dependencies?: string | null;
  depends_on_task_ids?: number[];
  recurrence_interval?: string | null;
  /** Required when recurrence_interval is yearly. */
  recurrence_month?: number | null;
  requester?: string | null;
  quarter?: string | null;
  project_label?: string | null;
};

export function isTaskOverdue(task: TaskRow): boolean {
  if (task.status === "done" || task.status === "cancelled") return false;
  const today = new Date().toISOString().slice(0, 10);
  if (task.due_date) return task.due_date < today;
  const created = new Date(task.created_at);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return created.getTime() < weekAgo;
}
