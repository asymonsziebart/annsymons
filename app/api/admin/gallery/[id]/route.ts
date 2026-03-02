import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getSqlOrThrow } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
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
      UPDATE gallery_items
      SET title = ${title}, description = ${description ?? null}, src = ${src}, type = ${type}
      WHERE id = ${parseInt(id, 10)}
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
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const sql = getSqlOrThrow();
    await sql`DELETE FROM gallery_items WHERE id = ${parseInt(id, 10)}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
