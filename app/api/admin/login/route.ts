import { NextResponse } from "next/server";
import { clearAdminSession, setAdminSession } from "@/lib/auth";
import { setTasksSession } from "@/lib/tasksAuth";
import { getAdminPassword, getTimPassword } from "@/lib/tasksPassword";
import { clearSiteUserSession, loginSiteUser } from "@/lib/siteUserAuth";
import { firstAllowedPath } from "@/lib/admin/pageAccess";
import { getOwnerEmail } from "@/lib/ownerAccount";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    // Primary path: email account (including Ann’s owner email)
    const result = await loginSiteUser(username, password);
    if (result.ok) {
      await clearAdminSession();
      // Owner also unlocks /tasks with the env admin password when they used it
      const adminPassword = getAdminPassword();
      if (result.user.role === "owner" && adminPassword) {
        await setTasksSession(adminPassword);
      }
      return NextResponse.json({
        ok: true,
        kind: result.user.role === "owner" ? "owner" : "site-user",
        next:
          result.user.role === "owner"
            ? "/admin"
            : firstAllowedPath(result.user.allowedPages),
      });
    }

    // Optional Tim bridge: username "tim" + TASKS_PASSWORD_TIM (full admin, not owner)
    const timPassword = getTimPassword();
    if (
      timPassword &&
      password === timPassword &&
      ["tim", "timothy", "timothy.symons"].includes(username.toLowerCase())
    ) {
      await clearSiteUserSession();
      await setAdminSession(timPassword);
      await setTasksSession(timPassword);
      return NextResponse.json({ ok: true, kind: "shared-admin", next: "/admin" });
    }

    return NextResponse.json(
      {
        error: result.error,
        hint:
          username.toLowerCase() === getOwnerEmail()
            ? "Use your owner email and ADMIN_PASSWORD (or your saved owner password)."
            : undefined,
      },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
