/**
 * External Tasks API - Subtask operations for a specific task
 * 
 * GET /api/v1/tasks/:id/subtasks - List a task's subtasks
 * POST /api/v1/tasks/:id/subtasks - Create one or more subtasks
 * 
 * Authentication: Bearer token (EXTERNAL_TASKS_API_KEY)
 */

import { NextResponse } from "next/server";
import { verifyExternalApiAuth } from "@/lib/externalTasksAuth";
import { getTaskById } from "@/lib/data/tasks";
import { getSubtasksForTask, createSubtask } from "@/lib/data/taskSubtasks";

/**
 * GET /api/v1/tasks/:id/subtasks - List a task's subtasks
 * 
 * Response: { subtasks: SubtaskRow[] }
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

    const subtasks = await getSubtasksForTask(id);
    return NextResponse.json({ subtasks });
  } catch (error) {
    console.error("Failed to fetch subtasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/tasks/:id/subtasks - Create one or more subtasks
 * 
 * Body: 
 *   { title: string } - Create a single subtask
 *   OR
 *   { titles: string[] } - Create multiple subtasks in order
 * 
 * Response: 
 *   { subtask: SubtaskRow } - For single creation
 *   OR
 *   { subtasks: SubtaskRow[] } - For batch creation
 */
export async function POST(
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

    const body = await request.json();

    // Check for batch creation (titles array)
    if (Array.isArray(body?.titles)) {
      const titles = body.titles.filter(
        (t: unknown) => typeof t === "string" && t.trim().length > 0
      );

      if (titles.length === 0) {
        return NextResponse.json(
          { error: "At least one non-empty title is required" },
          { status: 400 }
        );
      }

      const subtasks = [];
      for (const title of titles) {
        const subtask = await createSubtask(id, title);
        if (subtask) {
          subtasks.push(subtask);
        }
      }

      return NextResponse.json({ subtasks }, { status: 201 });
    }

    // Single creation (title string)
    const title = typeof body?.title === "string" ? body.title : "";
    if (!title.trim()) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const subtask = await createSubtask(id, title);
    if (!subtask) {
      return NextResponse.json(
        { error: "Failed to create subtask" },
        { status: 500 }
      );
    }

    return NextResponse.json({ subtask }, { status: 201 });
  } catch (error) {
    console.error("Failed to create subtask:", error);
    return NextResponse.json(
      { error: "Failed to create subtask" },
      { status: 500 }
    );
  }
}
