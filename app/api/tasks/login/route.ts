import { NextResponse } from "next/server";
import { setTasksSession } from "@/lib/tasksAuth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = body?.password ?? "";
    const expected = process.env.TASKS_PASSWORD;
    if (!expected) {
      return NextResponse.json(
        { error: "Tasks app is not configured." },
        { status: 500 }
      );
    }
    if (password !== expected) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    await setTasksSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
