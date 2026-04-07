import { NextResponse } from "next/server";
import { isTasksAuth } from "@/lib/tasksAuth";
import { getSubtasksForTask, createSubtask } from "@/lib/data/taskSubtasks";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isTasksAuth();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idStr } = await params;
  const taskId = parseInt(idStr, 10);
  if (Number.isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const subtasks = await getSubtasksForTask(taskId);
  return NextResponse.json({ subtasks });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isTasksAuth();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idStr } = await params;
  const taskId = parseInt(idStr, 10);
  if (Number.isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title : "";
    const sub = await createSubtask(taskId, title);
    if (!sub) {
      return NextResponse.json({ error: "Could not create subtask" }, { status: 400 });
    }
    return NextResponse.json({ subtask: sub });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
