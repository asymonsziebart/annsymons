import { NextResponse } from "next/server";
import {
  getTasksNeedingOverdueReminder,
  markOverdueReminderSent,
} from "@/lib/data/tasks";
import { sendOverdueTasksDigest } from "@/lib/email/sendOverdueTasksDigest";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron (or manual): GET with Authorization: Bearer CRON_SECRET
 * Sends one email listing all open tasks that are 7+ days old (at most once per week per task).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await getTasksNeedingOverdueReminder();
  if (tasks.length === 0) {
    return NextResponse.json({ ok: true, sent: false, message: "No overdue reminders due" });
  }

  const result = await sendOverdueTasksDigest(
    tasks.map((t) => ({ title: t.title, createdAt: t.created_at }))
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, taskCount: tasks.length },
      { status: 503 }
    );
  }

  await markOverdueReminderSent(tasks.map((t) => t.id));
  return NextResponse.json({
    ok: true,
    sent: true,
    taskCount: tasks.length,
  });
}
