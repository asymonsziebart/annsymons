"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/data/recipes";

type Props = {
  recipes: Recipe[];
};

export default function RecipeAdminList({ recipes }: Props) {
  const [query, setQuery] = useState("");

  const filteredRecipes = useMemo(() => {
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
  }, [query, recipes]);

  return (
    <section className="neo p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
            Recipe library
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {filteredRecipes.length} of {recipes.length} recipes shown
          </p>
        </div>
        <label className="w-full sm:max-w-xs">
          <span className="sr-only">Search recipes</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search recipes..."
            className="neo-input"
          />
        </label>
      </div>

      {filteredRecipes.length === 0 ? (
        <div className="neo-inset mt-6 p-6 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            No recipes match that search.
          </p>
          <Link
            href="/admin/recipes/new"
            className="neo-btn-primary mt-4"
          >
            Add a recipe
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {filteredRecipes.map((recipe) => (
            <li
              key={recipe.slug}
              className="neo-sm overflow-hidden card-hover"
            >
              {recipe.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={recipe.image}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="neo-inset flex h-40 items-center justify-center text-5xl text-[var(--color-muted)]">
                  🍳
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-heading text-lg font-semibold leading-snug text-[var(--color-ink)]">
                      {recipe.title}
                    </h3>
                    <p className="mt-1 break-all text-xs text-[var(--color-muted)]">
                      /recipes/{recipe.slug}
                    </p>
                  </div>
                </div>

                {recipe.description ? (
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                    {recipe.description}
                  </p>
                ) : null}

                <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="neo-inset px-3 py-2">
                    <dt className="font-semibold text-[var(--color-ink)]">Ingredients</dt>
                    <dd className="mt-1 text-[var(--color-muted)]">{recipe.ingredients.length}</dd>
                  </div>
                  <div className="neo-inset px-3 py-2">
                    <dt className="font-semibold text-[var(--color-ink)]">Steps</dt>
                    <dd className="mt-1 text-[var(--color-muted)]">{recipe.steps.length}</dd>
                  </div>
                  <div className="neo-inset px-3 py-2">
                    <dt className="font-semibold text-[var(--color-ink)]">Serves</dt>
                    <dd className="mt-1 text-[var(--color-muted)]">{recipe.servings || "n/a"}</dd>
                  </div>
                </dl>

                {(recipe.prepTime || recipe.cookTime) && (
                  <p className="mt-3 text-xs text-[var(--color-accent)]">
                    {[recipe.prepTime && `Prep: ${recipe.prepTime}`, recipe.cookTime && `Cook: ${recipe.cookTime}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/recipes/${recipe.slug}/edit`}
                    className="neo-btn-primary !min-h-10"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/recipes/${recipe.slug}`}
                    className="neo-btn !min-h-10"
                  >
                    View on site
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
