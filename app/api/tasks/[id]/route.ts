import { NextResponse } from "next/server";
import { isTasksAuth } from "@/lib/tasksAuth";
import { updateTask, deleteTask, isTaskStatus, type TaskStatus } from "@/lib/data/tasks";

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
    const body = await request.json();
    const patch: {
      title?: string;
      description?: string | null;
      due_date?: string | null;
      status?: TaskStatus;
    } = {};

    if (typeof body?.title === "string") patch.title = body.title;
    if (body?.description === null || typeof body?.description === "string") {
      patch.description = body.description;
    }
    if (body?.due_date === null || typeof body?.due_date === "string") {
      patch.due_date = body.due_date === "" ? null : body.due_date;
    }
    if (typeof body?.status === "string" && isTaskStatus(body.status)) {
      patch.status = body.status;
    }

    if (Object.keys(patch).length === 0) {
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
