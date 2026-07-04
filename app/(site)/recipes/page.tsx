import RecipeList from "@/components/RecipeList";
import { getAllRecipes } from "@/lib/data/recipes";

export const metadata = {
  title: "Recipes | Ann Symons",
  description: "Recipes and cooking ideas.",
};

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const recipes = await getAllRecipes();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-20">
      <header className="mb-8 sm:mb-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          Recipes
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
          Favorites and ideas. Click through for ingredients and steps.
        </p>
      </header>

      <RecipeList recipes={recipes} />
    </main>
  );
}
