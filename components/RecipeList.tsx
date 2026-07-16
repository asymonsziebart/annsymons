"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/data/recipes";

type Props = {
  recipes: Recipe[];
};

function filterRecipes(recipes: Recipe[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return recipes;

  return recipes.filter((recipe) => {
    const searchable = [
      recipe.title,
      recipe.slug,
      recipe.description,
      recipe.prepTime,
      recipe.cookTime,
      recipe.servings,
      ...recipe.ingredients,
      ...recipe.steps,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(normalizedQuery);
  });
}

export default function RecipeList({ recipes }: Props) {
  const [query, setQuery] = useState("");

  const filteredRecipes = useMemo(
    () => filterRecipes(recipes, query),
    [query, recipes],
  );

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm font-semibold text-[var(--color-muted)]">
          {filteredRecipes.length} of {recipes.length} recipes
        </p>
        <label className="w-full sm:max-w-sm">
          <span className="sr-only">Search recipes</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search recipes..."
            className="neo-input text-sm"
          />
        </label>
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 sm:gap-7">
        {recipes.length === 0 ? (
          <li className="neo col-span-full p-5 text-center text-[var(--color-muted)] sm:p-8">
            No recipes yet. Add them in the{" "}
            <Link href="/admin/recipes" className="font-semibold text-[var(--color-accent)] hover:underline">
              admin portal
            </Link>{" "}
            or{" "}
            <code className="neo-inset rounded px-1.5 py-0.5 text-[var(--color-ink-muted)]">
              lib/recipes.ts
            </code>
            .
          </li>
        ) : filteredRecipes.length === 0 ? (
          <li className="neo col-span-full p-5 text-center text-[var(--color-muted)] sm:p-8">
            No recipes match &ldquo;{query.trim()}&rdquo;.
          </li>
        ) : (
          filteredRecipes.map((recipe) => (
            <li key={recipe.slug}>
              <Link
                href={`/recipes/${recipe.slug}`}
                className="card-hover block overflow-hidden"
              >
                {recipe.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={recipe.image}
                    alt=""
                    className="h-44 w-full object-cover sm:h-48"
                  />
                ) : (
                  <div className="flex h-44 items-center justify-center text-5xl text-[var(--color-muted)] shadow-[var(--neo-shadow-in)] sm:h-48">
                    🍳
                  </div>
                )}
                <div className="p-5">
                  <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                    {recipe.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                    {recipe.description}
                  </p>
                  {(recipe.prepTime || recipe.cookTime || recipe.servings) && (
                    <p className="mt-3 text-xs font-bold text-[var(--color-accent)]">
                      {[recipe.prepTime, recipe.cookTime, recipe.servings]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </>
  );
}
