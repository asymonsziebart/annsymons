import { NextResponse } from "next/server";
import {
  getTasks,
  getTasksNeedingOverdueReminder,
  markOverdueReminderSent,
  TASK_STATUS_LABELS,
} from "@/lib/data/tasks";
import { sendOverdueTasksDigest } from "@/lib/email/sendOverdueTasksDigest";
import { sendAssigneeOpenTasksDigest } from "@/lib/email/sendAssigneeOpenTasksDigest";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron (or manual): GET with Authorization: Bearer CRON_SECRET
 * Sends:
 * 1. One email for overdue tasks (past due date, or no due date and 7+ days open), at most weekly per task.
 * 2. One email per assignee (Ann and Tim) with their open tasks, once per day.
 *
 * Query params:
 * - ?only=overdue — run only the overdue digest
 * - ?only=assignees — run only the assignee digest
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const only = url.searchParams.get("only");

  const results: {
    overdue?: { ok: boolean; sent: boolean; taskCount?: number; error?: string; message?: string };
    assignees?: { ok: boolean; ann: unknown; tim: unknown };
  } = {};

  // Run overdue digest
  if (!only || only === "overdue") {
    try {
      const tasks = await getTasksNeedingOverdueReminder();
      if (tasks.length === 0) {
        results.overdue = { ok: true, sent: false, message: "No overdue reminders due" };
      } else {
        const result = await sendOverdueTasksDigest(
          tasks.map((t) => ({
            title: t.title,
            createdAt: t.created_at,
            dueDate: t.due_date,
            statusLabel: TASK_STATUS_LABELS[t.status],
          }))
        );

        if (!result.ok) {
          results.overdue = {
            ok: false,
            sent: false,
            error: result.error,
            taskCount: tasks.length,
          };
        } else {
          await markOverdueReminderSent(tasks.map((t) => t.id));
          results.overdue = {
            ok: true,
            sent: true,
            taskCount: tasks.length,
          };
        }
      }
    } catch (error) {
      results.overdue = {
        ok: false,
        sent: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Run assignee digest
  if (!only || only === "assignees") {
    try {
      const allTasks = await getTasks();
      // Filter to open tasks (status not done or cancelled)
      const openTasks = allTasks.filter(
        (t) => t.status !== "done" && t.status !== "cancelled"
      );

      const digestResult = await sendAssigneeOpenTasksDigest(
        openTasks.map((t) => ({
          assignee: t.assignee,
          title: t.title,
          dueDate: t.due_date,
        }))
      );

      results.assignees = {
        ok: digestResult.ann.ok && digestResult.tim.ok,
        ann: digestResult.ann,
        tim: digestResult.tim,
      };
    } catch (error) {
      results.assignees = {
        ok: false,
        ann: { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
        tim: { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      };
    }
  }

  // Determine overall status
  const allOk =
    (!results.overdue || results.overdue.ok) && (!results.assignees || results.assignees.ok);

  return NextResponse.json(
    {
      ok: allOk,
      ...results,
    },
    { status: allOk ? 200 : 503 }
  );
}
