import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getSqlOrThrow } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  try {
    const body = await request.json();
    const { title, date, excerpt, body: bodyText } = body;
    if (!title || !bodyText) {
      return NextResponse.json(
        { error: "title and body are required" },
        { status: 400 }
      );
    }
    const sql = getSqlOrThrow();
    const dateVal = date || new Date().toISOString().slice(0, 10);
    await sql`
      UPDATE posts
      SET title = ${title}, date = ${dateVal}, excerpt = ${excerpt ?? null}, body = ${bodyText}, updated_at = NOW()
      WHERE slug = ${slug}
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  try {
    const sql = getSqlOrThrow();
    await sql`DELETE FROM posts WHERE slug = ${slug}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
