import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getSqlOrThrow } from "@/lib/db";
import { posts as staticPosts } from "@/lib/posts";
import { recipes as staticRecipes } from "@/lib/recipes";

export async function POST() {
  const ok = await isAdmin();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const sql = getSqlOrThrow();
    for (const post of staticPosts) {
      await sql`
        INSERT INTO posts (slug, title, date, excerpt, body)
        VALUES (${post.slug}, ${post.title}, ${post.date}, ${post.excerpt ?? null}, ${post.body})
        ON CONFLICT (slug) DO NOTHING
      `;
    }
    for (const r of staticRecipes) {
      await sql`
        INSERT INTO recipes (slug, title, description, prep_time, cook_time, servings, ingredients, steps, image)
        VALUES (
          ${r.slug},
          ${r.title},
          ${r.description},
          ${r.prepTime ?? null},
          ${r.cookTime ?? null},
          ${r.servings ?? null},
          ${r.ingredients ?? []},
          ${r.steps ?? []},
          ${r.image ?? null}
        )
        ON CONFLICT (slug) DO NOTHING
      `;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 }
    );
  }
}
