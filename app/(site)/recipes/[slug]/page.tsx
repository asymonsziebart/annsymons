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
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-20">
      <Link
        href="/recipes"
        className="link-accent inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-hover)]"
      >
        ← Back to Recipes
      </Link>
      <article className="mt-4 overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-[0_18px_50px_-34px_rgba(28,25,23,0.5)] ring-1 ring-[var(--color-border)] sm:mt-8">
        <div className="p-5 sm:p-12">
          <h1 className="font-heading text-balance text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
            {recipe.title}
          </h1>
          <p className="mt-3 text-[var(--color-ink-muted)] leading-relaxed">
            {recipe.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--color-accent)] sm:gap-4">
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

        <div className="grid gap-8 border-t border-[var(--color-border)] p-5 sm:grid-cols-2 sm:p-12">
          <div>
            <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
              Ingredients
            </h2>
            <ul className="mt-4 list-outside list-disc space-y-2 pl-5 text-[var(--color-ink-muted)]">
              {recipe.ingredients.map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
              Steps
            </h2>
            <ol className="mt-4 list-outside list-decimal space-y-3 pl-5 text-[var(--color-ink-muted)]">
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
