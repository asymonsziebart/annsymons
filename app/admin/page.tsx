import Link from "next/link";
import { getAllPosts } from "@/lib/data/posts";
import { getAllRecipes } from "@/lib/data/recipes";
import AdminLogoutButton from "./AdminLogoutButton";
import AdminSeedButton from "./AdminSeedButton";

export const metadata = {
  title: "Admin | Ann Symons",
  robots: "noindex, nofollow",
};

export default async function AdminDashboardPage() {
  const [posts, recipes] = await Promise.all([
    getAllPosts(),
    getAllRecipes(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold text-[var(--color-ink)]">
          Admin
        </h1>
        <div className="flex items-center gap-3">
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

      <div className="space-y-10">
        <section className="rounded-2xl bg-[var(--color-surface)] p-6 ring-1 ring-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
              Blog posts
            </h2>
            <Link
              href="/admin/posts/new"
              className="text-sm font-medium text-[var(--color-accent)] hover:underline"
            >
              + Add post
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {posts.length === 0 ? (
              <li className="text-sm text-[var(--color-muted)]">No posts yet.</li>
            ) : (
              posts.map((post) => (
                <li key={post.slug} className="flex items-center justify-between gap-4">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  >
                    {post.title}
                  </Link>
                  <Link
                    href={`/admin/posts/${post.slug}/edit`}
                    className="text-sm text-[var(--color-accent)] hover:underline"
                  >
                    Edit
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-2xl bg-[var(--color-surface)] p-6 ring-1 ring-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
              Recipes
            </h2>
            <Link
              href="/admin/recipes/new"
              className="text-sm font-medium text-[var(--color-accent)] hover:underline"
            >
              + Add recipe
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {recipes.length === 0 ? (
              <li className="text-sm text-[var(--color-muted)]">No recipes yet.</li>
            ) : (
              recipes.map((recipe) => (
                <li key={recipe.slug} className="flex items-center justify-between gap-4">
                  <Link
                    href={`/recipes/${recipe.slug}`}
                    className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  >
                    {recipe.title}
                  </Link>
                  <Link
                    href={`/admin/recipes/${recipe.slug}/edit`}
                    className="text-sm text-[var(--color-accent)] hover:underline"
                  >
                    Edit
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
