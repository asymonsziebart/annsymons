import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeBySlug } from "@/lib/data/recipes";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

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
        className="neo-btn !min-h-11 text-[var(--color-accent)]"
      >
        ← Back to Recipes
      </Link>
      <article className="neo mt-4 overflow-hidden sm:mt-8">
        <div className="p-5 sm:p-12">
          <h1 className="font-heading text-balance text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
            {recipe.title}
          </h1>
          <p className="mt-3 text-[var(--color-ink-muted)] leading-relaxed">
            {recipe.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
            {recipe.prepTime && (
              <span className="neo-chip !min-h-8 !py-1 text-xs text-[var(--color-accent)]">
                Prep: {recipe.prepTime}
              </span>
            )}
            {recipe.cookTime && (
              <span className="neo-chip !min-h-8 !py-1 text-xs text-[var(--color-accent)]">
                Cook: {recipe.cookTime}
              </span>
            )}
            {recipe.servings && (
              <span className="neo-chip !min-h-8 !py-1 text-xs text-[var(--color-accent)]">
                Serves: {recipe.servings}
              </span>
            )}
          </div>
        </div>

        {recipe.image && (
          <div className="mx-5 overflow-hidden rounded-[var(--neo-radius-sm)] shadow-[var(--neo-shadow-in)] sm:mx-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recipe.image}
              alt=""
              className="w-full object-cover"
            />
          </div>
        )}

        <div className="grid gap-8 p-5 sm:grid-cols-2 sm:p-12">
          <div className="neo-inset p-5">
            <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
              Ingredients
            </h2>
            <ul className="mt-4 list-outside list-disc space-y-2 pl-5 text-[var(--color-ink-muted)]">
              {recipe.ingredients.map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
            </ul>
          </div>
          <div className="neo-inset p-5">
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
