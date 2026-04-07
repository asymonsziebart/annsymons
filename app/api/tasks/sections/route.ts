import { NextResponse } from "next/server";
import { isTasksAuth } from "@/lib/tasksAuth";
import { getSections, createSection } from "@/lib/data/taskSections";

export async function GET() {
  const ok = await isTasksAuth();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sections = await getSections();
  return NextResponse.json({ sections });
}

export async function POST(request: Request) {
  const ok = await isTasksAuth();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name : "";
    const color_key =
      typeof body?.color_key === "string" ? body.color_key : "default";
    const section = await createSection(name, color_key);
    if (!section) {
      return NextResponse.json(
        { error: "Could not create section. Run db/migrate-tasks-asana-layout.sql in Neon." },
        { status: 503 }
      );
    }
    return NextResponse.json({ section });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
