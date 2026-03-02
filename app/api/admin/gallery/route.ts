import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getSqlOrThrow } from "@/lib/db";

export async function POST(request: Request) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const { title, description, src, type } = body;
    if (!title || !src || !type) {
      return NextResponse.json(
        { error: "title, src, and type are required" },
        { status: 400 }
      );
    }
    const sql = getSqlOrThrow();
    await sql`
      INSERT INTO gallery_items (title, description, src, type)
      VALUES (${title}, ${description ?? null}, ${src}, ${type})
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
