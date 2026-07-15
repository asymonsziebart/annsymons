import Link from "next/link";
import { getAllPosts } from "@/lib/data/posts";
import { getAllRecipes } from "@/lib/data/recipes";
import { getPurchaseRequestCounts } from "@/lib/data/purchaseRequests";
import AdminLogoutButton from "./AdminLogoutButton";
import AdminSeedButton from "./AdminSeedButton";
import AdminDashboardClient from "./AdminDashboardClient";

export const metadata = {
  title: "Admin | Ann Symons",
  robots: "noindex, nofollow",
};

export default async function AdminDashboardPage() {
  const [posts, recipes, purchaseRequestCounts] = await Promise.all([
    getAllPosts(),
    getAllRecipes(),
    getPurchaseRequestCounts(),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-semibold text-[var(--color-ink)]">
          Admin
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/recipes"
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
            Recipes
          </Link>
          <Link
            href="/admin/garage"
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Garage
          </Link>
          <Link
            href="/admin/manuals"
            className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Manuals
          </Link>
          <Link
            href="/admin/dogs"
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Puppy Ranch
          </Link>
          <Link
            href="/admin/voices"
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
            Voices
          </Link>
          <Link
            href="/admin/requests"
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Requests
          </Link>
          <AdminSeedButton />
          <AdminLogoutButton />
          <Link
            href="/"
            className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            View site →
          </Link>
        </div>
      </div>

      <AdminDashboardClient
        posts={posts.map((post) => ({ slug: post.slug, title: post.title }))}
        recipes={recipes.map((recipe) => ({ slug: recipe.slug, title: recipe.title }))}
        purchaseRequestCounts={purchaseRequestCounts}
      />
    </div>
  );
}
