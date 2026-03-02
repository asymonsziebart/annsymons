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
    const { title, description, prepTime, cookTime, servings, ingredients, steps, image } = body;
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const sql = getSqlOrThrow();
    const ing = Array.isArray(ingredients) ? ingredients : [];
    const st = Array.isArray(steps) ? steps : [];
    await sql`
      UPDATE recipes
      SET title = ${title}, description = ${description ?? null}, prep_time = ${prepTime ?? null},
          cook_time = ${cookTime ?? null}, servings = ${servings ?? null},
          ingredients = ${ing}, steps = ${st}, image = ${image ?? null}, updated_at = NOW()
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
