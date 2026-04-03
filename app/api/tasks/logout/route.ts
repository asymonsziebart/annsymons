import { NextResponse } from "next/server";
import { clearTasksSession } from "@/lib/tasksAuth";

export async function POST() {
  await clearTasksSession();
  return NextResponse.json({ ok: true });
}
