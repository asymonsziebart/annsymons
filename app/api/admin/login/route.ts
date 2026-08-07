import { NextResponse } from "next/server";
import { clearAdminSession, setAdminSession } from "@/lib/auth";
import { setTasksSession } from "@/lib/tasksAuth";
import { getTimPassword } from "@/lib/tasksPassword";
import { clearSiteUserSession, loginSiteUser } from "@/lib/siteUserAuth";
import { firstAllowedPath } from "@/lib/admin/pageAccess";
import { getOwnerEmail, getOwnerLoginPassword } from "@/lib/ownerAccount";

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
      const ownerPassword = getOwnerLoginPassword();
      if (result.user.role === "owner" && ownerPassword) {
        await setTasksSession(ownerPassword);
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

    // Owner email + env password: always let Ann in even if DB setup failed.
    const ownerPassword = getOwnerLoginPassword();
    if (
      ownerPassword &&
      password === ownerPassword &&
      username.toLowerCase() === getOwnerEmail()
    ) {
      await clearSiteUserSession();
      await setAdminSession(ownerPassword);
      await setTasksSession(ownerPassword);
      return NextResponse.json({
        ok: true,
        kind: "owner-env",
        next: "/admin",
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
        error: result.error || "Invalid username or password.",
        hint:
          username.toLowerCase() === getOwnerEmail()
            ? "Use a.krause10597@gmail.com and your ADMIN_PASSWORD (or TASKS_PASSWORD if that is what you use)."
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
