import { NextResponse } from "next/server";
import { isTasksAuth } from "@/lib/tasksAuth";
import {
  updateTask,
  deleteTask,
  isTaskStatus,
  isTaskPriority,
  type TaskPatch,
} from "@/lib/data/tasks";

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
  } catch {
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
