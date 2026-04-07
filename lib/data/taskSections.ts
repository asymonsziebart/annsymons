import { getSql } from "@/lib/db";
import type { TaskSectionRow } from "./taskClientTypes";

export type { TaskSectionRow } from "./taskClientTypes";

function mapSection(row: Record<string, unknown>): TaskSectionRow {
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    color_key: String(row.color_key ?? "default"),
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ""),
  };
}

export async function getSections(): Promise<TaskSectionRow[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    const rows = await sql`
      SELECT id, name, color_key, sort_order, created_at::text as created_at
      FROM task_sections
      ORDER BY sort_order ASC, id ASC
    `;
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => mapSection(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function createSection(
  name: string,
  colorKey: string = "default"
): Promise<TaskSectionRow | null> {
  const sql = getSql();
  if (!sql) return null;
  const n = name.trim();
  if (!n) return null;
  try {
    const maxRows = await sql`SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM task_sections`;
    const next =
      Array.isArray(maxRows) && maxRows[0] && typeof maxRows[0] === "object"
        ? Number((maxRows[0] as { next?: number }).next ?? 0)
        : 0;
    const rows = await sql`
      INSERT INTO task_sections (name, color_key, sort_order)
      VALUES (${n}, ${colorKey}, ${next})
      RETURNING id, name, color_key, sort_order, created_at::text as created_at
    `;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row !== "object") return null;
    return mapSection(row as Record<string, unknown>);
  } catch {
    return null;
  }
}
