import { NextResponse } from "next/server";
import { isTasksAuth } from "@/lib/tasksAuth";
import {
  updateTask,
  deleteTask,
  isTaskStatus,
  isTaskPriority,
  type TaskPatch,
} from "@/lib/data/tasks";
import {
  TaskCompletionBlockedError,
  TaskDependsInvalidError,
} from "@/lib/data/taskDependencies";
import {
  isRecurrenceIntervalString,
  isValidRecurrenceMonth,
} from "@/lib/data/taskRecurrence";

function parsePatch(body: Record<string, unknown>): TaskPatch | null {
  const patch: TaskPatch = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (body.description === null || typeof body.description === "string") {
    patch.description = body.description;
  }
  if (body.due_date === null || typeof body.due_date === "string") {
    patch.due_date = body.due_date === "" ? null : body.due_date;
  }
  if (typeof body.status === "string" && isTaskStatus(body.status)) {
    patch.status = body.status;
  }
  if (typeof body.section_id === "number" || typeof body.section_id === "string") {
    patch.section_id = Number(body.section_id);
  }
  if (body.assignee === null || typeof body.assignee === "string") {
    patch.assignee = body.assignee === "" ? null : body.assignee;
  }
  if (typeof body.priority === "string" && isTaskPriority(body.priority)) {
    patch.priority = body.priority;
  }
  if (body.estimated_minutes === null || typeof body.estimated_minutes === "number") {
    patch.estimated_minutes = body.estimated_minutes;
  }
  if (body.actual_minutes === null || typeof body.actual_minutes === "number") {
    patch.actual_minutes = body.actual_minutes;
  }
  if (body.dependencies === null || typeof body.dependencies === "string") {
    patch.dependencies = body.dependencies === "" ? null : body.dependencies;
  }
  if (body.requester === null || typeof body.requester === "string") {
    patch.requester = body.requester === "" ? null : body.requester;
  }
  if (body.quarter === null || typeof body.quarter === "string") {
    patch.quarter = body.quarter === "" ? null : body.quarter;
  }
  if (body.project_label === null || typeof body.project_label === "string") {
    patch.project_label = body.project_label === "" ? null : body.project_label;
  }
  if (Array.isArray(body.depends_on_task_ids)) {
    const ids: number[] = [];
    for (const x of body.depends_on_task_ids) {
      const n =
        typeof x === "number" ? x : typeof x === "string" ? parseInt(String(x), 10) : NaN;
      if (Number.isInteger(n) && n > 0) ids.push(n);
    }
    patch.depends_on_task_ids = [...new Set(ids)].sort((a, b) => a - b);
  }
  if (body.recurrence_month === null || body.recurrence_month === "") {
    patch.recurrence_month = null;
  } else if (typeof body.recurrence_month === "number" && isValidRecurrenceMonth(body.recurrence_month)) {
    patch.recurrence_month = body.recurrence_month;
  } else if (typeof body.recurrence_month === "string") {
    const n = parseInt(body.recurrence_month, 10);
    if (isValidRecurrenceMonth(n)) patch.recurrence_month = n;
  }
  if (body.recurrence_interval === null || body.recurrence_interval === "") {
    patch.recurrence_interval = null;
  } else if (
    typeof body.recurrence_interval === "string" &&
    isRecurrenceIntervalString(body.recurrence_interval)
  ) {
    patch.recurrence_interval = body.recurrence_interval.trim();
  }
  return Object.keys(patch).length ? patch : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isTasksAuth();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const patch = parsePatch(body);
    if (!patch) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
    const task = await updateTask(id, patch);
    if (!task) {
      return NextResponse.json({ error: "Task not found or update failed" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, task });
  } catch (e) {
    if (e instanceof TaskCompletionBlockedError) {
      return NextResponse.json(
        { error: e.message, blocking_task_ids: e.blockingIds },
        { status: 409 }
      );
    }
    if (e instanceof TaskDependsInvalidError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isTasksAuth();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    await deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
