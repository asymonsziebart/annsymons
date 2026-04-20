import { NextResponse } from "next/server";
import { isTasksAuth } from "@/lib/tasksAuth";
import { backfillTaskPrioritiesFromSection } from "@/lib/data/tasks";

export async function POST() {
  const ok = await isTasksAuth();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const updated = await backfillTaskPrioritiesFromSection();
    return NextResponse.json({ ok: true, updated });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
