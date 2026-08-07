import { NextResponse } from "next/server";
import { setAdminSession, clearAdminSession } from "@/lib/auth";
import { setTasksSession } from "@/lib/tasksAuth";
import { getAllAdminPasswords } from "@/lib/tasksPassword";
import { clearSiteUserSession, loginSiteUser } from "@/lib/siteUserAuth";
import { firstAllowedPath } from "@/lib/admin/pageAccess";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = String(body?.password ?? "");
    const email = String(body?.email ?? "").trim();

    // Account login (email + password)
    if (email) {
      const result = await loginSiteUser(email, password);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 401 });
      }
      await clearAdminSession();
      return NextResponse.json({
        ok: true,
        kind: "site-user",
        next: firstAllowedPath(result.user.allowedPages),
      });
    }

    // Shared admin password (Ann / Tim)
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
    const match = valid.find((p) => p === password.trim());
    if (match == null) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    await clearSiteUserSession();
    await setAdminSession(match);
    await setTasksSession(match);
    return NextResponse.json({ ok: true, kind: "admin", next: "/admin" });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
