import { NextResponse } from "next/server";
import { setTasksSession } from "@/lib/tasksAuth";
import { getTasksPassword } from "@/lib/tasksPassword";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = String(body?.password ?? "").trim();
    const expected = getTasksPassword();
    if (!expected) {
      return NextResponse.json(
        {
          error:
            "Tasks login is not configured. Set TASKS_PASSWORD or ADMIN_PASSWORD in your environment (e.g. Vercel).",
        },
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
