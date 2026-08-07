import { NextResponse } from "next/server";
import { createSiteUserRequest } from "@/lib/data/siteUsers";

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
