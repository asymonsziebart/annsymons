import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeBySlug, getAllRecipes } from "@/lib/data/recipes";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const recipes = await getAllRecipes();
  return recipes.map((recipe) => ({ slug: recipe.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) return { title: "Recipe | Ann Symons" };
  return { title: `${recipe.title} | Ann Symons` };
}

export default async function RecipePage({ params }: Props) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-8 sm:py-20">
      <Link
        href="/recipes"
        className="text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors link-accent inline-block"
      >
        ← Back to Recipes
      </Link>
      <article className="mt-8 overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-[0_4px_24px_-4px_rgba(28,25,23,0.08)] ring-1 ring-[var(--color-border)]">
        <div className="p-8 sm:p-12">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
            {recipe.title}
          </h1>
          <p className="mt-3 text-[var(--color-ink-muted)] leading-relaxed">
            {recipe.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--color-accent)]">
            {recipe.prepTime && <span>Prep: {recipe.prepTime}</span>}
            {recipe.cookTime && <span>Cook: {recipe.cookTime}</span>}
            {recipe.servings && <span>Serves: {recipe.servings}</span>}
          </div>
        </div>

        {recipe.image && (
          <div className="overflow-hidden border-t border-[var(--color-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recipe.image}
              alt=""
              className="w-full object-cover"
            />
          </div>
        )}

        <div className="grid gap-8 border-t border-[var(--color-border)] p-8 sm:grid-cols-2 sm:p-12">
          <div>
            <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
              Ingredients
            </h2>
            <ul className="mt-4 list-inside list-disc space-y-2 text-[var(--color-ink-muted)]">
              {recipe.ingredients.map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
              Steps
            </h2>
            <ol className="mt-4 list-inside list-decimal space-y-3 text-[var(--color-ink-muted)]">
              {recipe.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </article>
    </main>
  );
}
