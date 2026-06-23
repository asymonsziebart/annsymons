import Link from "next/link";
import { getSql } from "@/lib/db";
import { getAllRecipes } from "@/lib/data/recipes";
import RecipeAdminList from "./RecipeAdminList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recipes | Admin | Ann Symons",
  robots: "noindex, nofollow",
};

export default async function AdminRecipesPage() {
  const dbReady = getSql() !== null;
  const recipes = await getAllRecipes();
  const recipesWithPhotos = recipes.filter((recipe) => recipe.image).length;
  const recipesWithTiming = recipes.filter(
    (recipe) => recipe.prepTime || recipe.cookTime
  ).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/admin"
            className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            ← Admin
          </Link>
          <h1 className="mt-3 font-heading text-3xl font-semibold text-[var(--color-ink)]">
            Recipes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">
            Add recipes with photos, descriptions, prep details, ingredients, and steps.
            Saved recipes appear on the public recipes page right away.
          </p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Public page:{" "}
            <Link href="/recipes" className="font-medium text-[var(--color-accent)] hover:underline">
              /recipes
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/recipes"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)]"
          >
            View public page
          </Link>
          <Link
            href="/admin/recipes/new"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
            + Add recipe
          </Link>
        </div>
      </div>

      {!dbReady ? (
        <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Recipe saving needs the configured site database. The list below is the
          built-in recipe content that the public site can fall back to.
        </p>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[var(--color-surface)] p-4 ring-1 ring-[var(--color-border)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Total
          </p>
          <p className="mt-2 font-heading text-3xl font-semibold text-[var(--color-ink)]">
            {recipes.length}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--color-surface)] p-4 ring-1 ring-[var(--color-border)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            With photos
          </p>
          <p className="mt-2 font-heading text-3xl font-semibold text-[var(--color-ink)]">
            {recipesWithPhotos}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--color-surface)] p-4 ring-1 ring-[var(--color-border)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            With timing
          </p>
          <p className="mt-2 font-heading text-3xl font-semibold text-[var(--color-ink)]">
            {recipesWithTiming}
          </p>
        </div>
      </div>

      <RecipeAdminList recipes={recipes} />
    </main>
  );
}
