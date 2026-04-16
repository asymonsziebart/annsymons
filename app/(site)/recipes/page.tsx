import Link from "next/link";
import { getAllRecipes } from "@/lib/data/recipes";

export const metadata = {
  title: "Recipes | Ann Symons",
  description: "Recipes and cooking ideas.",
};

export default async function RecipesPage() {
  const recipes = await getAllRecipes();

  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:px-8 sm:py-20">
      <header className="mb-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          Recipes
        </h1>
        <p className="mt-3 text-lg text-[var(--color-muted)]">
          Favorites and ideas. Click through for ingredients and steps.
        </p>
      </header>

      <ul className="grid gap-6 sm:grid-cols-2">
        {recipes.length === 0 ? (
          <li className="col-span-full rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-[var(--color-muted)]">
            No recipes yet. Add them in the{" "}
            <Link href="/admin" className="text-[var(--color-accent)] hover:underline">admin portal</Link> or{" "}
            <code className="rounded bg-[var(--color-cream-dark)] px-1.5 py-0.5 text-[var(--color-ink-muted)]">
              lib/recipes.ts
            </code>
            .
          </li>
        ) : (
          recipes.map((recipe) => (
            <li key={recipe.slug}>
              <Link
                href={`/recipes/${recipe.slug}`}
                className="card-hover block overflow-hidden rounded-2xl bg-[var(--color-surface)] ring-1 ring-[var(--color-border)]"
              >
                {recipe.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={recipe.image}
                    alt=""
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-[var(--color-cream-dark)] text-5xl">
                    🍳
                  </div>
                )}
                <div className="p-5">
                  <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                    {recipe.title}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--color-ink-muted)] line-clamp-2 leading-relaxed">
                    {recipe.description}
                  </p>
                  {(recipe.prepTime || recipe.cookTime || recipe.servings) && (
                    <p className="mt-3 text-xs text-[var(--color-accent)]">
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
    </main>
  );
}
