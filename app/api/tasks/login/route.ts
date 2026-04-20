import { NextResponse } from "next/server";
import { setTasksSession } from "@/lib/tasksAuth";
import { getAllTasksPasswords } from "@/lib/tasksPassword";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = String(body?.password ?? "").trim();
    const valid = getAllTasksPasswords();
    if (valid.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tasks login is not configured. Set TASKS_PASSWORD or ADMIN_PASSWORD (and optionally TASKS_PASSWORD_TIM) in your environment (e.g. Vercel).",
        },
        { status: 500 }
      );
    }
    const match = valid.find((p) => p === password);
    if (match == null) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    await setTasksSession(match);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
