import { getSql } from "@/lib/db";
import { getAllRecipes as getStaticRecipes, getRecipeBySlug as getStaticRecipeBySlug, type Recipe } from "@/lib/recipes";

export type { Recipe };

type DbRecipe = {
  slug: string;
  title: string;
  description: string | null;
  prep_time: string | null;
  cook_time: string | null;
  servings: string | null;
  ingredients: string[];
  steps: string[];
  image: string | null;
};

function toRecipe(r: DbRecipe): Recipe {
  return {
    slug: r.slug,
    title: r.title,
    description: r.description ?? "",
    prepTime: r.prep_time ?? undefined,
    cookTime: r.cook_time ?? undefined,
    servings: r.servings ?? undefined,
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? [],
    image: r.image ?? undefined,
  };
}

/** Prefer DB fields, but keep a static image when the DB row has none. */
function mergeWithStatic(recipe: Recipe, staticRecipe?: Recipe): Recipe {
  if (!staticRecipe?.image || recipe.image) return recipe;
  return { ...recipe, image: staticRecipe.image };
}

export async function getAllRecipes(): Promise<Recipe[]> {
  const sql = getSql();
  if (!sql) return getStaticRecipes();
  try {
    const rows = await sql`
      SELECT slug, title, description, prep_time, cook_time, servings, ingredients, steps, image
      FROM recipes
      ORDER BY title
    `;
    if (Array.isArray(rows) && rows.length > 0) {
      const recipesBySlug = new Map<string, Recipe>();
      for (const recipe of getStaticRecipes()) {
        recipesBySlug.set(recipe.slug, recipe);
      }
      for (const row of rows as DbRecipe[]) {
        const recipe = toRecipe(row);
        const existing = recipesBySlug.get(recipe.slug);
        recipesBySlug.set(recipe.slug, mergeWithStatic(recipe, existing));
      }
      return Array.from(recipesBySlug.values()).sort((a, b) =>
        a.title.localeCompare(b.title)
      );
    }
  } catch {
    // fallback
  }
  return getStaticRecipes();
}

export async function getRecipeBySlug(slug: string): Promise<Recipe | undefined> {
  const sql = getSql();
  if (!sql) return getStaticRecipeBySlug(slug);
  try {
    const rows = await sql`
      SELECT slug, title, description, prep_time, cook_time, servings, ingredients, steps, image
      FROM recipes
      WHERE slug = ${slug}
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row && typeof row === "object") {
      return mergeWithStatic(toRecipe(row as DbRecipe), getStaticRecipeBySlug(slug));
    }
  } catch {
    // fallback
  }
  return getStaticRecipeBySlug(slug);
}
