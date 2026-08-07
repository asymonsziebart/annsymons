import { NextResponse } from "next/server";
import { createSiteUserRequest } from "@/lib/data/siteUsers";
import { sendAccessRequestNotify } from "@/lib/email/sendAccessRequestNotify";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createSiteUserRequest({
      name: String(body?.name ?? ""),
      email: String(body?.email ?? ""),
      password: String(body?.password ?? ""),
    });
    if (!result.ok) {
      const status = result.error.includes("db/site-users.sql") ? 503 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    // Notify Ann so she can approve/deny from Manage Users.
    // Don't fail the request if email delivery fails.
    try {
      await sendAccessRequestNotify({
        name: result.user.name,
        email: result.user.email,
      });
    } catch {
      /* ignore notify failures */
    }

    return NextResponse.json({
      ok: true,
      message:
        "Request submitted. Ann will review it and choose which pages you can see.",
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
