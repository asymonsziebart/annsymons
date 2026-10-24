/**
 * External Tasks API - List and Create tasks
 * 
 * GET /api/v1/tasks - List all tasks
 * POST /api/v1/tasks - Create a new task
 * 
 * Authentication: Bearer token (EXTERNAL_TASKS_API_KEY)
 */

import { NextResponse } from "next/server";
import { verifyExternalApiAuth } from "@/lib/externalTasksAuth";
import { notifyWebhook } from "@/lib/tasksWebhook";
import {
  getTasks,
  createTask,
  isTaskStatus,
  isTaskPriority,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/data/tasks";
import { getSections } from "@/lib/data/taskSections";
import {
  TaskCompletionBlockedError,
  TaskDependsInvalidError,
} from "@/lib/data/taskDependencies";
import {
  isRecurrenceIntervalString,
  isValidRecurrenceMonth,
} from "@/lib/data/taskRecurrence";

/**
 * GET /api/v1/tasks - List all tasks
 * 
 * Query parameters:
 * - updated_since: ISO 8601 timestamp (optional) - only return tasks created after this time
 * 
 * Response: { tasks: TaskRow[], sections: TaskSectionRow[], timestamp: string }
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!verifyExternalApiAuth(authHeader)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid Bearer token in the Authorization header." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const updatedSince = searchParams.get("updated_since");

    let tasks = await getTasks();
    const sections = await getSections();

    if (updatedSince) {
      const sinceDate = new Date(updatedSince);
      if (!isNaN(sinceDate.getTime())) {
        tasks = tasks.filter((task) => {
          const taskDate = new Date(task.created_at);
          return taskDate >= sinceDate;
        });
      }
    }

    return NextResponse.json({
      tasks,
      sections,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/tasks - Create a new task
 * 
 * Body: {
 *   title: string (required)
 *   section_id: number (required)
 *   description?: string | null
 *   due_date?: string | null (YYYY-MM-DD)
 *   status?: "todo" | "in_progress" | "blocked" | "done" | "cancelled"
 *   assignee?: string | null
 *   priority?: "none" | "high" | "medium" | "low"
 *   estimated_minutes?: number | null
 *   actual_minutes?: number | null
 *   dependencies?: string | null
 *   depends_on_task_ids?: number[]
 *   recurrence_interval?: "daily" | "weekly" | "monthly" | "yearly" | null
 *   recurrence_month?: number | null (1-12, required if recurrence_interval is "yearly")
 *   requester?: string | null
 *   quarter?: string | null
 *   project_label?: string | null
 * }
 * 
 * Response: { task: TaskRow }
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!verifyExternalApiAuth(authHeader)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid Bearer token in the Authorization header." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    
    const title = typeof body?.title === "string" ? body.title : "";
    if (!title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    
    const section_id = Number(body?.section_id);
    if (!Number.isFinite(section_id)) {
      return NextResponse.json({ error: "section_id is required and must be a number" }, { status: 400 });
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
    if (typeof body?.status === "string" && isTaskStatus(body.status)) {
      status = body.status;
    }

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

    let recurrence_interval: string | null | undefined;
    if (body?.recurrence_interval === null || body?.recurrence_interval === "") {
      recurrence_interval = null;
    } else if (
      typeof body?.recurrence_interval === "string" &&
      isRecurrenceIntervalString(body.recurrence_interval)
    ) {
      recurrence_interval = body.recurrence_interval.trim();
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
      assignee,
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
      recurrence_interval,
      recurrence_month,
    });

    // Notify webhook if configured
    await notifyWebhook({ type: "task.created", task });

    return NextResponse.json({ task }, { status: 201 });
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
    console.error("Failed to create task:", e);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
