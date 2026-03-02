import { NextResponse } from "next/server";
import { setAdminSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = body?.password ?? "";
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return NextResponse.json(
        { error: "Admin login is not configured." },
        { status: 500 }
      );
    }
    if (password !== expected) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    await setAdminSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
