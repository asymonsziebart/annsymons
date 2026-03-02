import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeBySlug } from "@/lib/data/recipes";
import RecipeForm from "../../RecipeForm";

type Props = { params: Promise<{ slug: string }> };

export const metadata = {
  title: "Edit recipe | Admin | Ann Symons",
  robots: "noindex, nofollow",
};

export default async function EditRecipePage({ params }: Props) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <Link href="/admin" className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]">
        ← Admin
      </Link>
      <h1 className="mt-4 font-heading text-2xl font-semibold text-[var(--color-ink)]">
        Edit recipe
      </h1>
      <RecipeForm {...recipe} />
    </div>
  );
}
