import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/auth";
import { getAllRecipes, getRecipeBySlug } from "@/lib/data/recipes";
import { isTasksAuth } from "@/lib/tasksAuth";

export async function GET(request: Request) {
  const ok = (await isAdmin()) || (await isTasksAuth());
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (slug) {
    const recipe = await getRecipeBySlug(slug);
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
    return NextResponse.json({ recipe });
  }

  const recipes = await getAllRecipes();
  return NextResponse.json({ recipes });
}
