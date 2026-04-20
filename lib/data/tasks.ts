import { getSqlOrThrow } from "@/lib/db";
import type { CreateTaskInput, TaskPatch, TaskRow, TaskPriority } from "./taskClientTypes";
import {
  normalizeTaskPriority,
  normalizeTaskStatus,
  TASK_PRIORITIES,
  priorityInferredFromSectionName,
} from "./taskClientTypes";

export type { CreateTaskInput, TaskPatch, TaskRow } from "./taskClientTypes";
export {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  isTaskOverdue,
  isTaskPriority,
  isTaskStatus,
  normalizeTaskPriority,
  normalizeTaskStatus,
  priorityInferredFromSectionName,
  type TaskPriority,
  type TaskStatus,
} from "./taskClientTypes";

/**
 * Neon/pg often return DATE as a JS Date. `String(d).slice(0, 10)` is wrong (e.g. "Mon Apr 06").
 */
function mapPgDateOnly(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (m) return m[1]!;
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

function mapRow(r: Record<string, unknown>): TaskRow {
  return {
    id: Number(r.id),
    title: String(r.title ?? ""),
    description: r.description != null ? String(r.description) : null,
    due_date: mapPgDateOnly(r.due_date),
    status: normalizeTaskStatus(String(r.status ?? "todo")),
    sort_order: Number(r.sort_order ?? 0),
    created_at: String(r.created_at ?? ""),
    last_overdue_email_at:
      r.last_overdue_email_at != null ? String(r.last_overdue_email_at) : null,
    section_id: Number(r.section_id),
    section_name: String(r.section_name ?? ""),
    assignee: r.assignee != null ? String(r.assignee) : null,
    priority: normalizeTaskPriority(String(r.priority ?? "none")),
    estimated_minutes:
      r.estimated_minutes != null ? Number(r.estimated_minutes) : null,
    actual_minutes: r.actual_minutes != null ? Number(r.actual_minutes) : null,
    dependencies: r.dependencies != null ? String(r.dependencies) : null,
    requester: r.requester != null ? String(r.requester) : null,
    quarter: r.quarter != null ? String(r.quarter) : null,
    project_label: r.project_label != null ? String(r.project_label) : null,
    subtask_count: Number(r.subtask_count ?? 0),
  };
}

export async function getTasks(): Promise<TaskRow[]> {
  const sql = getSqlOrThrow();
  const rows = await sql`
    SELECT t.id, t.title, t.description, t.due_date, t.status, t.sort_order,
           t.created_at::text AS created_at,
           t.last_overdue_email_at::text AS last_overdue_email_at,
           t.section_id, s.name AS section_name,
           t.assignee, t.priority, t.estimated_minutes, t.actual_minutes,
           t.dependencies, t.requester, t.quarter, t.project_label,
           (SELECT COUNT(*)::int FROM task_subtasks st WHERE st.task_id = t.id) AS subtask_count
    FROM tasks t
    JOIN task_sections s ON s.id = t.section_id
    ORDER BY s.sort_order, t.sort_order, t.id
  `;
  return (rows as Record<string, unknown>[]).map(mapRow);
}

export async function getTaskById(id: number): Promise<TaskRow | null> {
  const sql = getSqlOrThrow();
  const rows = await sql`
    SELECT t.id, t.title, t.description, t.due_date, t.status, t.sort_order,
           t.created_at::text AS created_at,
           t.last_overdue_email_at::text AS last_overdue_email_at,
           t.section_id, s.name AS section_name,
           t.assignee, t.priority, t.estimated_minutes, t.actual_minutes,
           t.dependencies, t.requester, t.quarter, t.project_label,
           (SELECT COUNT(*)::int FROM task_subtasks st WHERE st.task_id = t.id) AS subtask_count
    FROM tasks t
    JOIN task_sections s ON s.id = t.section_id
    WHERE t.id = ${id}
  `;
  const r = (rows as Record<string, unknown>[])[0];
  return r ? mapRow(r) : null;
}

/**
 * When no priority is specified for a new task, use the most common priority in the section;
 * on a tie, prefer the last task in section order (as if the new row followed it).
 */
function defaultPriorityFromSectionTaskRows(
  rawRows: Record<string, unknown>[]
): TaskPriority {
  if (rawRows.length === 0) return "none";
  const rows = rawRows.map((r) => ({
    priority: String(r.priority ?? "none"),
    sort_order: Number(r.sort_order ?? 0),
    id: Number(r.id),
  }));
  const counts = new Map<TaskPriority, number>();
  for (const p of TASK_PRIORITIES) counts.set(p, 0);
  for (const r of rows) {
    const p = normalizeTaskPriority(r.priority);
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  let bestCount = 0;
  for (const c of counts.values()) {
    if (c > bestCount) bestCount = c;
  }
  const atMax = TASK_PRIORITIES.filter((p) => (counts.get(p) ?? 0) === bestCount);
  if (atMax.length === 1) return atMax[0]!;

  for (let i = rows.length - 1; i >= 0; i--) {
    const p = normalizeTaskPriority(rows[i]!.priority);
    if (atMax.includes(p)) return p;
  }
  return atMax[0]!;
}

function resolvePriorityForTaskInSection(task: TaskRow, allInSection: TaskRow[]): TaskPriority {
  const fromName = priorityInferredFromSectionName(task.section_name);
  if (fromName) return fromName;
  const peers = allInSection.filter((x) => x.id !== task.id);
  const raw: Record<string, unknown>[] = peers.map((p) => ({
    priority: p.priority,
    sort_order: p.sort_order,
    id: p.id,
  }));
  const fromPeers = defaultPriorityFromSectionTaskRows(raw);
  if (fromPeers !== "none") return fromPeers;
  return "medium";
}

/**
 * Set priority for tasks that are still "none" using the section name and/or other tasks in that section; persists to the DB.
 */
export async function backfillTaskPrioritiesFromSection(): Promise<number> {
  const tasks = await getTasks();
  const bySec = new Map<number, TaskRow[]>();
  for (const t of tasks) {
    const list = bySec.get(t.section_id) ?? [];
    list.push(t);
    bySec.set(t.section_id, list);
  }
  let n = 0;
  for (const t of tasks) {
    if (t.priority !== "none") continue;
    const allIn = bySec.get(t.section_id) ?? [t];
    const next = resolvePriorityForTaskInSection(t, allIn);
    if (next === "none") continue;
    const row = await updateTask(t.id, { priority: next });
    if (row) n += 1;
  }
  return n;
}

export async function createTask(input: CreateTaskInput): Promise<TaskRow> {
  const sql = getSqlOrThrow();
  const status = normalizeTaskStatus(input.status ?? "todo");
  let priority: TaskPriority;
  if (input.priority !== undefined) {
    priority = normalizeTaskPriority(input.priority);
  } else {
    const existing = await sql`
      SELECT priority, sort_order, id
      FROM tasks
      WHERE section_id = ${input.section_id}
      ORDER BY sort_order ASC, id ASC
    `;
    priority = defaultPriorityFromSectionTaskRows(
      existing as Record<string, unknown>[]
    );
  }
  const rows = await sql`
    INSERT INTO tasks (
      title, description, due_date, status, section_id, sort_order,
      assignee, priority, estimated_minutes, actual_minutes,
      dependencies, requester, quarter, project_label
    )
    VALUES (
      ${input.title},
      ${input.description ?? null},
      ${input.due_date ?? null},
      ${status},
      ${input.section_id},
      (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tasks WHERE section_id = ${input.section_id}),
      ${input.assignee ?? null},
      ${priority},
      ${input.estimated_minutes ?? null},
      ${input.actual_minutes ?? null},
      ${input.dependencies ?? null},
      ${input.requester ?? null},
      ${input.quarter ?? null},
      ${input.project_label ?? null}
    )
    RETURNING id
  `;
  const id = Number((rows as { id: number }[])[0]?.id);
  const task = await getTaskById(id);
  if (!task) throw new Error("Failed to load created task");
  return task;
}

export async function updateTask(id: number, patch: TaskPatch): Promise<TaskRow | null> {
  const sql = getSqlOrThrow();
  const existing = await getTaskById(id);
  if (!existing) return null;

  const title = patch.title ?? existing.title;
  const description =
    patch.description !== undefined ? patch.description : existing.description;
  const due_date = patch.due_date !== undefined ? patch.due_date : existing.due_date;
  const status = patch.status !== undefined ? normalizeTaskStatus(patch.status) : existing.status;
  const section_id = patch.section_id ?? existing.section_id;
  const assignee = patch.assignee !== undefined ? patch.assignee : existing.assignee;
  const priority =
    patch.priority !== undefined
      ? normalizeTaskPriority(patch.priority)
      : existing.priority;
  const estimated_minutes =
    patch.estimated_minutes !== undefined
      ? patch.estimated_minutes
      : existing.estimated_minutes;
  const actual_minutes =
    patch.actual_minutes !== undefined ? patch.actual_minutes : existing.actual_minutes;
  const dependencies =
    patch.dependencies !== undefined ? patch.dependencies : existing.dependencies;
  const requester = patch.requester !== undefined ? patch.requester : existing.requester;
  const quarter = patch.quarter !== undefined ? patch.quarter : existing.quarter;
  const project_label =
    patch.project_label !== undefined ? patch.project_label : existing.project_label;

  await sql`
    UPDATE tasks SET
      title = ${title},
      description = ${description},
      due_date = ${due_date},
      status = ${status},
      section_id = ${section_id},
      assignee = ${assignee},
      priority = ${priority},
      estimated_minutes = ${estimated_minutes},
      actual_minutes = ${actual_minutes},
      dependencies = ${dependencies},
      requester = ${requester},
      quarter = ${quarter},
      project_label = ${project_label}
    WHERE id = ${id}
  `;
  return getTaskById(id);
}

export async function deleteTask(id: number): Promise<boolean> {
  const sql = getSqlOrThrow();
  const rows = await sql`
    DELETE FROM tasks WHERE id = ${id} RETURNING id
  `;
  return Array.isArray(rows) && rows.length > 0;
}

export async function reorderTasksInSection(
  sectionId: number,
  orderedIds: number[]
): Promise<void> {
  const sql = getSqlOrThrow();
  for (let i = 0; i < orderedIds.length; i++) {
    await sql`
      UPDATE tasks SET sort_order = ${i} WHERE id = ${orderedIds[i]} AND section_id = ${sectionId}
    `;
  }
}

export async function moveTaskToSection(
  taskId: number,
  newSectionId: number,
  newSortOrder: number
): Promise<void> {
  const sql = getSqlOrThrow();
  await sql`
    UPDATE tasks SET section_id = ${newSectionId}, sort_order = ${newSortOrder} WHERE id = ${taskId}
  `;
}

/** Overdue (past due or no due & open 7+ days), not done/cancelled, at most one digest per task per week. */
export async function getTasksNeedingOverdueReminder(): Promise<TaskRow[]> {
  const sql = getSqlOrThrow();
  const rows = await sql`
    SELECT t.id, t.title, t.description, t.due_date, t.status, t.sort_order,
           t.created_at::text AS created_at,
           t.last_overdue_email_at::text AS last_overdue_email_at,
           t.section_id, s.name AS section_name,
           t.assignee, t.priority, t.estimated_minutes, t.actual_minutes,
           t.dependencies, t.requester, t.quarter, t.project_label,
           (SELECT COUNT(*)::int FROM task_subtasks st WHERE st.task_id = t.id) AS subtask_count
    FROM tasks t
    JOIN task_sections s ON s.id = t.section_id
    WHERE t.status NOT IN ('done', 'cancelled')
      AND (
        (t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE)
        OR
        (t.due_date IS NULL AND t.created_at < (NOW() - INTERVAL '7 days'))
      )
      AND (
        t.last_overdue_email_at IS NULL
        OR t.last_overdue_email_at < (NOW() - INTERVAL '7 days')
      )
  `;
  return (rows as Record<string, unknown>[]).map(mapRow);
}

export async function markOverdueReminderSent(taskIds: number[]): Promise<void> {
  if (taskIds.length === 0) return;
  const sql = getSqlOrThrow();
  for (const id of taskIds) {
    await sql`
      UPDATE tasks SET last_overdue_email_at = NOW() WHERE id = ${id}
    `;
  }
}
