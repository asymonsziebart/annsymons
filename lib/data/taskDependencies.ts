import type { TaskRow } from "./taskClientTypes";

export class TaskCompletionBlockedError extends Error {
  readonly name = "TaskCompletionBlockedError";
  constructor(public readonly blockingIds: number[]) {
    super("Complete prerequisite tasks first.");
  }
}

export class TaskDependsInvalidError extends Error {
  readonly name = "TaskDependsInvalidError";
  constructor(message: string) {
    super(message);
  }
}

export function parseDependsOnTaskIds(raw: unknown): number[] {
  if (raw == null || raw === "") return [];
  const s = String(raw).trim();
  if (!s) return [];
  try {
    const j = JSON.parse(s) as unknown;
    if (!Array.isArray(j)) return [];
    const out: number[] = [];
    for (const x of j) {
      const n = typeof x === "number" ? x : typeof x === "string" ? parseInt(x, 10) : NaN;
      if (Number.isInteger(n) && n > 0) out.push(n);
    }
    return [...new Set(out)].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function serializeDependsOnTaskIds(ids: number[]): string | null {
  const u = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  return u.length ? JSON.stringify(u) : null;
}

/** Tasks in `depends_on_task_ids` that are not yet done (or cancelled). */
export function blockingPrerequisiteTasks(task: TaskRow, byId: Map<number, TaskRow>): TaskRow[] {
  const blockers: TaskRow[] = [];
  for (const depId of task.depends_on_task_ids) {
    const d = byId.get(depId);
    if (!d) continue;
    if (d.status !== "done" && d.status !== "cancelled") blockers.push(d);
  }
  return blockers;
}

function getDepsForTask(
  taskId: number,
  proposedForTaskId: number,
  proposedDeps: number[],
  byId: Map<number, TaskRow>
): number[] {
  if (taskId === proposedForTaskId) return proposedDeps;
  return byId.get(taskId)?.depends_on_task_ids ?? [];
}

/** True if adding `proposedDeps` to `taskId` creates a dependency cycle. */
export function dependencyWouldCycle(
  taskId: number,
  proposedDeps: number[],
  allTasks: TaskRow[]
): boolean {
  const byId = new Map(allTasks.map((t) => [t.id, t]));

  function dfs(from: number, stack: Set<number>): boolean {
    if (from === taskId) return true;
    if (stack.has(from)) return true;
    stack.add(from);
    for (const x of getDepsForTask(from, taskId, proposedDeps, byId)) {
      if (dfs(x, stack)) {
        stack.delete(from);
        return true;
      }
    }
    stack.delete(from);
    return false;
  }

  for (const d of proposedDeps) {
    if (dfs(d, new Set())) return true;
  }
  return false;
}

export function normalizeDependsOnIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const x of raw) {
    const n = typeof x === "number" ? x : typeof x === "string" ? parseInt(String(x), 10) : NaN;
    if (Number.isInteger(n) && n > 0) out.push(n);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export function validateDependsOnForSave(
  taskId: number,
  ids: number[],
  allTasks: TaskRow[]
): void {
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  for (const depId of ids) {
    if (depId === taskId) {
      throw new TaskDependsInvalidError("A task cannot depend on itself.");
    }
    const dep = byId.get(depId);
    if (!dep) {
      throw new TaskDependsInvalidError(`Task #${depId} does not exist.`);
    }
  }
  if (dependencyWouldCycle(taskId, ids, allTasks)) {
    throw new TaskDependsInvalidError("That would create a circular dependency.");
  }
}
