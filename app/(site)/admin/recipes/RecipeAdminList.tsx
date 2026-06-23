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
    <section className="rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-6">
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
            className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </label>
      </div>

      {filteredRecipes.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-cream)]/60 p-6 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            No recipes match that search.
          </p>
          <Link
            href="/admin/recipes/new"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
            Add a recipe
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {filteredRecipes.map((recipe) => (
            <li
              key={recipe.slug}
              className="overflow-hidden rounded-2xl bg-[var(--color-cream)]/60 ring-1 ring-[var(--color-border)]"
            >
              {recipe.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={recipe.image}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-[var(--color-cream-dark)] text-5xl">
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
                  <div className="rounded-xl bg-white/70 px-3 py-2">
                    <dt className="font-semibold text-[var(--color-ink)]">Ingredients</dt>
                    <dd className="mt-1 text-[var(--color-muted)]">{recipe.ingredients.length}</dd>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2">
                    <dt className="font-semibold text-[var(--color-ink)]">Steps</dt>
                    <dd className="mt-1 text-[var(--color-muted)]">{recipe.steps.length}</dd>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2">
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
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/recipes/${recipe.slug}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)]"
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
