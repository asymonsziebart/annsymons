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
