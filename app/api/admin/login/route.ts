import { NextResponse } from "next/server";
import { setAdminSession } from "@/lib/auth";
import { setTasksSession } from "@/lib/tasksAuth";
import { getAllAdminPasswords } from "@/lib/tasksPassword";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = String(body?.password ?? "").trim();
    const valid = getAllAdminPasswords();
    if (valid.length === 0) {
      return NextResponse.json(
        {
          error:
            "Admin login is not configured. Set ADMIN_PASSWORD (and optionally TASKS_PASSWORD_TIM) in your environment (e.g. Vercel).",
        },
        { status: 500 }
      );
    }
    const match = valid.find((p) => p === password);
    if (match == null) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    await setAdminSession(match);
    // Same password unlocks /tasks without a second sign-in.
    await setTasksSession(match);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
