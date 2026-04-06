import { getSql } from "@/lib/db";

export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export function isTaskStatus(s: string): s is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(s);
}

export function normalizeTaskStatus(s: string): TaskStatus {
  return isTaskStatus(s) ? s : "todo";
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
};

function mapRow(row: Record<string, unknown>): TaskRow {
  return {
    id: Number(row.id),
    title: String(row.title ?? ""),
    description: row.description == null ? null : String(row.description),
    due_date: row.due_date == null || row.due_date === "" ? null : String(row.due_date).slice(0, 10),
    status: normalizeTaskStatus(String(row.status ?? "todo")),
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ""),
    last_overdue_email_at:
      row.last_overdue_email_at == null ? null : String(row.last_overdue_email_at),
  };
}

export async function getTasks(): Promise<TaskRow[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    const rows = await sql`
      SELECT id, title, description, due_date::text as due_date, status, sort_order,
        created_at::text as created_at, last_overdue_email_at::text as last_overdue_email_at
      FROM tasks
      ORDER BY
        CASE WHEN status IN ('done', 'cancelled') THEN 1 ELSE 0 END,
        due_date ASC NULLS LAST,
        id ASC
    `;
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => mapRow(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function getTaskById(id: number): Promise<TaskRow | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const rows = await sql`
      SELECT id, title, description, due_date::text as due_date, status, sort_order,
        created_at::text as created_at, last_overdue_email_at::text as last_overdue_email_at
      FROM tasks WHERE id = ${id} LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row !== "object") return null;
    return mapRow(row as Record<string, unknown>);
  } catch {
    return null;
  }
}

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  due_date?: string | null;
  status?: TaskStatus;
};

export async function createTask(input: CreateTaskInput): Promise<TaskRow | null> {
  const sql = getSql();
  if (!sql) return null;
  const title = input.title.trim();
  if (!title) return null;
  const description =
    input.description == null || String(input.description).trim() === ""
      ? null
      : String(input.description).trim();
  const due_date =
    input.due_date == null || String(input.due_date).trim() === ""
      ? null
      : String(input.due_date).slice(0, 10);
  const status = input.status ? normalizeTaskStatus(input.status) : "todo";

  try {
    const rows = await sql`
      INSERT INTO tasks (title, description, due_date, status, sort_order)
      VALUES (${title}, ${description}, ${due_date}, ${status}, 0)
      RETURNING id, title, description, due_date::text as due_date, status, sort_order,
        created_at::text as created_at, last_overdue_email_at::text as last_overdue_email_at
    `;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row !== "object") return null;
    return mapRow(row as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function updateTask(
  id: number,
  patch: Partial<Pick<TaskRow, "title" | "description" | "due_date" | "status">>
): Promise<TaskRow | null> {
  const current = await getTaskById(id);
  if (!current) return null;

  const title =
    patch.title !== undefined ? patch.title.trim() : current.title;
  if (!title) return null;

  let description: string | null;
  if (patch.description !== undefined) {
    const d = patch.description;
    description =
      d === null || String(d).trim() === "" ? null : String(d).trim();
  } else {
    description = current.description;
  }

  let due_date: string | null;
  if (patch.due_date !== undefined) {
    const d = patch.due_date;
    due_date = d === null || String(d).trim() === "" ? null : String(d).slice(0, 10);
  } else {
    due_date = current.due_date;
  }

  const status =
    patch.status !== undefined ? normalizeTaskStatus(patch.status) : current.status;

  const sql = getSql();
  if (!sql) return null;
  try {
    const rows = await sql`
      UPDATE tasks
      SET title = ${title},
          description = ${description},
          due_date = ${due_date},
          status = ${status}
      WHERE id = ${id}
      RETURNING id, title, description, due_date::text as due_date, status, sort_order,
        created_at::text as created_at, last_overdue_email_at::text as last_overdue_email_at
    `;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row !== "object") return null;
    return mapRow(row as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Open tasks that are overdue (past due date, or no due date and 7+ days old). */
export async function getTasksNeedingOverdueReminder(): Promise<TaskRow[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    const rows = await sql`
      SELECT id, title, description, due_date::text as due_date, status, sort_order,
        created_at::text as created_at, last_overdue_email_at::text as last_overdue_email_at
      FROM tasks
      WHERE status NOT IN ('done', 'cancelled')
        AND (
          (due_date IS NOT NULL AND due_date < CURRENT_DATE)
          OR (due_date IS NULL AND created_at < NOW() - INTERVAL '7 days')
        )
        AND (
          last_overdue_email_at IS NULL
          OR last_overdue_email_at < NOW() - INTERVAL '7 days'
        )
      ORDER BY due_date ASC NULLS LAST, created_at ASC
    `;
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => mapRow(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function markOverdueReminderSent(ids: number[]): Promise<void> {
  const sql = getSql();
  if (!sql || ids.length === 0) return;
  for (const id of ids) {
    await sql`UPDATE tasks SET last_overdue_email_at = NOW() WHERE id = ${id}`;
  }
}

export async function deleteTask(id: number): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  await sql`DELETE FROM tasks WHERE id = ${id}`;
  return true;
}

/** True if task should show as overdue in the UI (not terminal status). */
export function isTaskOverdue(task: TaskRow): boolean {
  if (task.status === "done" || task.status === "cancelled") return false;
  const today = new Date().toISOString().slice(0, 10);
  if (task.due_date) return task.due_date < today;
  const created = new Date(task.created_at);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return created.getTime() < weekAgo;
}
