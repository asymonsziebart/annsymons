import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getSqlOrThrow } from "@/lib/db";

export async function POST(request: Request) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const { slug, title, date, excerpt, body: bodyText, image } = body;
    if (!slug || !title || !bodyText) {
      return NextResponse.json(
        { error: "slug, title, and body are required" },
        { status: 400 }
      );
    }
    const sql = getSqlOrThrow();
    const dateVal = date || new Date().toISOString().slice(0, 10);
    await sql`
      INSERT INTO posts (slug, title, date, excerpt, body, image)
      VALUES (${slug}, ${title}, ${dateVal}, ${excerpt ?? null}, ${bodyText}, ${image ?? null})
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        date = EXCLUDED.date,
        excerpt = EXCLUDED.excerpt,
        body = EXCLUDED.body,
        image = EXCLUDED.image,
        updated_at = NOW()
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
