import { NextResponse } from "next/server";
import { isTasksAuth } from "@/lib/tasksAuth";
import { createTask, isTaskStatus, type TaskStatus } from "@/lib/data/tasks";

export async function POST(request: Request) {
  const ok = await isTasksAuth();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title : "";
    const description =
      body?.description === null || body?.description === undefined
        ? null
        : typeof body.description === "string"
          ? body.description
          : null;
    const due_date =
      body?.due_date === null || body?.due_date === undefined || body?.due_date === ""
        ? null
        : typeof body.due_date === "string"
          ? body.due_date
          : null;
    let status: TaskStatus | undefined;
    if (typeof body?.status === "string" && isTaskStatus(body.status)) {
      status = body.status;
    }

    const task = await createTask({ title, description, due_date, status });
    if (!task) {
      return NextResponse.json(
        {
          error:
            "Could not create task. Run db/migrate-tasks-v2-fields.sql in Neon if you upgraded from an older tasks table.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ task });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
