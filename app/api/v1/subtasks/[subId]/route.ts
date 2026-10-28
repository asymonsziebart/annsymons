/**
 * External Tasks API - Individual subtask operations
 * 
 * PATCH /api/v1/subtasks/:subId - Update a subtask
 * DELETE /api/v1/subtasks/:subId - Delete a subtask
 * 
 * Authentication: Bearer token (EXTERNAL_TASKS_API_KEY)
 */

import { NextResponse } from "next/server";
import { verifyExternalApiAuth } from "@/lib/externalTasksAuth";
import { updateSubtask, deleteSubtask } from "@/lib/data/taskSubtasks";

/**
 * PATCH /api/v1/subtasks/:subId - Update a subtask
 * 
 * Body: {
 *   title?: string
 *   done?: boolean
 * }
 * 
 * Response: { subtask: SubtaskRow }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ subId: string }> }
) {
  const authHeader = request.headers.get("authorization");
  if (!verifyExternalApiAuth(authHeader)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid Bearer token in the Authorization header." },
      { status: 401 }
    );
  }

  const { subId: subIdStr } = await params;
  const subId = parseInt(subIdStr, 10);
  if (Number.isNaN(subId) || subId <= 0) {
    return NextResponse.json({ error: "Invalid subtask id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const patch: { title?: string; done?: boolean } = {};

    if (typeof body?.title === "string") {
      patch.title = body.title;
    }
    if (typeof body?.done === "boolean") {
      patch.done = body.done;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update. Provide title and/or done." },
        { status: 400 }
      );
    }

    const subtask = await updateSubtask(subId, patch);
    if (!subtask) {
      return NextResponse.json(
        { error: "Subtask not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ subtask });
  } catch (error) {
    console.error("Failed to update subtask:", error);
    return NextResponse.json(
      { error: "Failed to update subtask" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/subtasks/:subId - Delete a subtask
 * 
 * Response: { ok: true }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ subId: string }> }
) {
  const authHeader = request.headers.get("authorization");
  if (!verifyExternalApiAuth(authHeader)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid Bearer token in the Authorization header." },
      { status: 401 }
    );
  }

  const { subId: subIdStr } = await params;
  const subId = parseInt(subIdStr, 10);
  if (Number.isNaN(subId) || subId <= 0) {
    return NextResponse.json({ error: "Invalid subtask id" }, { status: 400 });
  }

  try {
    const success = await deleteSubtask(subId);
    if (!success) {
      return NextResponse.json(
        { error: "Subtask not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete subtask:", error);
    return NextResponse.json(
      { error: "Failed to delete subtask" },
      { status: 500 }
    );
  }
}
