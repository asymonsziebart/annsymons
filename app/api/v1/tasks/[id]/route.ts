/**
 * External Tasks API - Individual task operations
 * 
 * GET /api/v1/tasks/:id - Get a single task
 * PATCH /api/v1/tasks/:id - Update a task
 * DELETE /api/v1/tasks/:id - Delete a task
 * 
 * Authentication: Bearer token (EXTERNAL_TASKS_API_KEY)
 */

import { NextResponse } from "next/server";
import { verifyExternalApiAuth } from "@/lib/externalTasksAuth";
import { notifyWebhook } from "@/lib/tasksWebhook";
import {
  getTaskById,
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

/**
 * GET /api/v1/tasks/:id - Get a single task
 * 
 * Response: { task: TaskRow }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get("authorization");
  if (!verifyExternalApiAuth(authHeader)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid Bearer token in the Authorization header." },
      { status: 401 }
    );
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  try {
    const task = await getTaskById(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Failed to fetch task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

/**
 * PATCH /api/v1/tasks/:id - Update a task
 * 
 * Body: Partial task fields (same as POST, all optional)
 * 
 * Response: { task: TaskRow }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get("authorization");
  if (!verifyExternalApiAuth(authHeader)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid Bearer token in the Authorization header." },
      { status: 401 }
    );
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const patch = parsePatch(body);
    
    if (!patch) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const existing = await getTaskById(id);
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = await updateTask(id, patch);
    if (!task) {
      return NextResponse.json(
        { error: "Task not found or update failed" },
        { status: 404 }
      );
    }

    // Notify webhook if configured
    await notifyWebhook({ type: "task.updated", task });

    return NextResponse.json({ task });
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
    console.error("Failed to update task:", e);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/tasks/:id - Delete a task
 * 
 * Response: { ok: true }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get("authorization");
  if (!verifyExternalApiAuth(authHeader)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid Bearer token in the Authorization header." },
      { status: 401 }
    );
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  try {
    const success = await deleteTask(id);
    if (!success) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Notify webhook if configured
    await notifyWebhook({ type: "task.deleted", taskId: id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
