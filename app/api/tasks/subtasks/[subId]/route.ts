import { NextResponse } from "next/server";
import { isTasksAuth } from "@/lib/tasksAuth";
import { updateSubtask, deleteSubtask } from "@/lib/data/taskSubtasks";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ subId: string }> }
) {
  const ok = await isTasksAuth();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { subId: sid } = await params;
  const subId = parseInt(sid, 10);
  if (Number.isNaN(subId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const body = await request.json();
    const patch: { title?: string; done?: boolean } = {};
    if (typeof body?.title === "string") patch.title = body.title;
    if (typeof body?.done === "boolean") patch.done = body.done;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields" }, { status: 400 });
    }
    const sub = await updateSubtask(subId, patch);
    if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ subtask: sub });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ subId: string }> }
) {
  const ok = await isTasksAuth();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { subId: sid } = await params;
  const subId = parseInt(sid, 10);
  if (Number.isNaN(subId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const okDel = await deleteSubtask(subId);
  if (!okDel) return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
