import { NextResponse } from "next/server";
import { isTasksAuth } from "@/lib/tasksAuth";
import { getTasks } from "@/lib/data/tasks";
import { getSections } from "@/lib/data/taskSections";

export async function GET() {
  const ok = await isTasksAuth();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [tasks, sections] = await Promise.all([getTasks(), getSections()]);
  return NextResponse.json({ tasks, sections });
}
