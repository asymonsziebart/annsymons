import { NextResponse } from "next/server";
import { isTasksAuth } from "@/lib/tasksAuth";
import {
  createTask,
  isTaskStatus,
  isTaskPriority,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/data/tasks";
import {
  TaskCompletionBlockedError,
  TaskDependsInvalidError,
} from "@/lib/data/taskDependencies";
import { isValidRecurrenceMonth } from "@/lib/data/taskRecurrence";

export async function POST(request: Request) {
  const ok = await isTasksAuth();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title : "";
    const section_id = Number(body?.section_id);
    if (!Number.isFinite(section_id)) {
      return NextResponse.json({ error: "section_id is required" }, { status: 400 });
    }

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
    if (typeof body?.status === "string" && isTaskStatus(body.status)) status = body.status;

    let priority: TaskPriority | undefined;
    if (typeof body?.priority === "string" && isTaskPriority(body.priority)) {
      priority = body.priority;
    }

    const assignee =
      typeof body?.assignee === "string" || body?.assignee === null ? body.assignee : undefined;
    const estimated_minutes =
      body?.estimated_minutes === null || body?.estimated_minutes === undefined
        ? undefined
        : Number(body.estimated_minutes);
    const actual_minutes =
      body?.actual_minutes === null || body?.actual_minutes === undefined
        ? undefined
        : Number(body.actual_minutes);
    const dependencies =
      typeof body?.dependencies === "string" || body?.dependencies === null
        ? body.dependencies
        : undefined;
    const requester =
      typeof body?.requester === "string" || body?.requester === null
        ? body.requester
        : undefined;
    const quarter =
      typeof body?.quarter === "string" || body?.quarter === null ? body.quarter : undefined;
    const project_label =
      typeof body?.project_label === "string" || body?.project_label === null
        ? body.project_label
        : undefined;

    let depends_on_task_ids: number[] | undefined;
    if (Array.isArray(body?.depends_on_task_ids)) {
      const ids: number[] = [];
      for (const x of body.depends_on_task_ids) {
        const n =
          typeof x === "number" ? x : typeof x === "string" ? parseInt(String(x), 10) : NaN;
        if (Number.isInteger(n) && n > 0) ids.push(n);
      }
      depends_on_task_ids = [...new Set(ids)].sort((a, b) => a - b);
    }

    let recurrence_month: number | null | undefined;
    if (body?.recurrence_month === null || body?.recurrence_month === "") {
      recurrence_month = null;
    } else if (typeof body?.recurrence_month === "number" && isValidRecurrenceMonth(body.recurrence_month)) {
      recurrence_month = body.recurrence_month;
    } else if (typeof body?.recurrence_month === "string") {
      const n = parseInt(body.recurrence_month, 10);
      if (isValidRecurrenceMonth(n)) recurrence_month = n;
    }

    const task = await createTask({
      title,
      section_id,
      description,
      due_date,
      status,
      assignee: assignee === undefined ? undefined : assignee,
      priority,
      estimated_minutes:
        estimated_minutes === undefined || Number.isNaN(estimated_minutes)
          ? undefined
          : estimated_minutes,
      actual_minutes:
        actual_minutes === undefined || Number.isNaN(actual_minutes)
          ? undefined
          : actual_minutes,
      dependencies,
      requester,
      quarter,
      project_label,
      depends_on_task_ids,
      recurrence_month,
    });

    if (!task) {
      return NextResponse.json(
        {
          error:
            "Could not create task. Run db/migrate-tasks-asana-layout.sql in Neon (sections + columns + subtasks table).",
        },
        { status: 503 }
      );
    }
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
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
