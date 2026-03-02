import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getSqlOrThrow } from "@/lib/db";

export async function POST(request: Request) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const { slug, title, description, prepTime, cookTime, servings, ingredients, steps, image } = body;
    if (!slug || !title) {
      return NextResponse.json(
        { error: "slug and title are required" },
        { status: 400 }
      );
    }
    const sql = getSqlOrThrow();
    const ing = Array.isArray(ingredients) ? ingredients : [];
    const st = Array.isArray(steps) ? steps : [];
    await sql`
      INSERT INTO recipes (slug, title, description, prep_time, cook_time, servings, ingredients, steps, image)
      VALUES (${slug}, ${title}, ${description ?? null}, ${prepTime ?? null}, ${cookTime ?? null}, ${servings ?? null}, ${ing}, ${st}, ${image ?? null})
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        prep_time = EXCLUDED.prep_time,
        cook_time = EXCLUDED.cook_time,
        servings = EXCLUDED.servings,
        ingredients = EXCLUDED.ingredients,
        steps = EXCLUDED.steps,
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
