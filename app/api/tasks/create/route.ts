import { NextResponse } from "next/server";
import { isTasksAuth } from "@/lib/tasksAuth";
import { createTask } from "@/lib/data/tasks";

export async function POST(request: Request) {
  const ok = await isTasksAuth();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title : "";
    const task = await createTask(title);
    if (!task) {
      return NextResponse.json(
        { error: "Could not create task. Is DATABASE_URL set and the tasks table created?" },
        { status: 503 }
      );
    }
    return NextResponse.json({ task });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
