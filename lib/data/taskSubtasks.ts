import { getSql } from "@/lib/db";
import type { SubtaskRow } from "./taskClientTypes";

export type { SubtaskRow } from "./taskClientTypes";

function mapSub(row: Record<string, unknown>): SubtaskRow {
  return {
    id: Number(row.id),
    task_id: Number(row.task_id),
    title: String(row.title ?? ""),
    done: Boolean(row.done),
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ""),
  };
}

export async function getSubtasksForTask(taskId: number): Promise<SubtaskRow[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    const rows = await sql`
      SELECT id, task_id, title, done, sort_order, created_at::text as created_at
      FROM task_subtasks
      WHERE task_id = ${taskId}
      ORDER BY sort_order ASC, id ASC
    `;
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => mapSub(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function createSubtask(taskId: number, title: string): Promise<SubtaskRow | null> {
  const sql = getSql();
  if (!sql) return null;
  const t = title.trim();
  if (!t) return null;
  try {
    const maxRows = await sql`
      SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM task_subtasks WHERE task_id = ${taskId}
    `;
    const next =
      Array.isArray(maxRows) && maxRows[0] && typeof maxRows[0] === "object"
        ? Number((maxRows[0] as { next?: number }).next ?? 0)
        : 0;
    const rows = await sql`
      INSERT INTO task_subtasks (task_id, title, done, sort_order)
      VALUES (${taskId}, ${t}, false, ${next})
      RETURNING id, task_id, title, done, sort_order, created_at::text as created_at
    `;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row !== "object") return null;
    return mapSub(row as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function updateSubtask(
  subId: number,
  patch: Partial<Pick<SubtaskRow, "title" | "done">>
): Promise<SubtaskRow | null> {
  const sql = getSql();
  if (!sql) return null;
  const currentRows = await sql`
    SELECT id, task_id, title, done, sort_order, created_at::text as created_at
    FROM task_subtasks WHERE id = ${subId} LIMIT 1
  `;
  const cur = Array.isArray(currentRows) ? currentRows[0] : currentRows;
  if (!cur || typeof cur !== "object") return null;
  const c = mapSub(cur as Record<string, unknown>);
  const title = patch.title !== undefined ? patch.title.trim() : c.title;
  if (!title) return null;
  const done = patch.done !== undefined ? patch.done : c.done;
  try {
    const rows = await sql`
      UPDATE task_subtasks SET title = ${title}, done = ${done}
      WHERE id = ${subId}
      RETURNING id, task_id, title, done, sort_order, created_at::text as created_at
    `;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row !== "object") return null;
    return mapSub(row as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function deleteSubtask(subId: number): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  try {
    await sql`DELETE FROM task_subtasks WHERE id = ${subId}`;
    return true;
  } catch {
    return false;
  }
}
