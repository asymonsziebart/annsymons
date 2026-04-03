import { getSql } from "@/lib/db";

export type TaskRow = {
  id: number;
  title: string;
  done: boolean;
  sort_order: number;
  created_at: string;
  last_overdue_email_at?: string | null;
};

export async function getTasks(): Promise<TaskRow[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    const rows = await sql`
      SELECT id, title, done, sort_order, created_at::text as created_at
      FROM tasks
      ORDER BY sort_order ASC, id ASC
    `;
    return Array.isArray(rows) ? (rows as TaskRow[]) : [];
  } catch {
    return [];
  }
}

export async function createTask(title: string): Promise<TaskRow | null> {
  const sql = getSql();
  if (!sql) return null;
  const trimmed = title.trim();
  if (!trimmed) return null;
  const rows = await sql`
    INSERT INTO tasks (title, done, sort_order)
    VALUES (${trimmed}, false, 0)
    RETURNING id, title, done, sort_order, created_at::text as created_at
  `;
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row && typeof row === "object" ? (row as TaskRow) : null;
}

export async function updateTaskDone(id: number, done: boolean): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  await sql`UPDATE tasks SET done = ${done} WHERE id = ${id}`;
  return true;
}

/** Open tasks older than 7 days that need a reminder (none sent, or last sent 7+ days ago). */
export async function getTasksNeedingOverdueReminder(): Promise<TaskRow[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    const rows = await sql`
      SELECT id, title, done, sort_order, created_at::text as created_at,
        last_overdue_email_at::text as last_overdue_email_at
      FROM tasks
      WHERE done = false
        AND created_at < NOW() - INTERVAL '7 days'
        AND (
          last_overdue_email_at IS NULL
          OR last_overdue_email_at < NOW() - INTERVAL '7 days'
        )
      ORDER BY created_at ASC
    `;
    return Array.isArray(rows) ? (rows as TaskRow[]) : [];
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
