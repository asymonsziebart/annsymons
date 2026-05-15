import Link from "next/link";
import { getAllPosts } from "@/lib/data/posts";
import { getAllRecipes } from "@/lib/data/recipes";
import AdminLogoutButton from "./AdminLogoutButton";
import AdminSeedButton from "./AdminSeedButton";

const privatePages = [
  { href: "/tasks", label: "Tasks", description: "Private task board" },
  { href: "/statephotos", label: "State Photos", description: "Map photo manager" },
  { href: "/archery", label: "Archery", description: "Hidden practice page" },
  { href: "/admin/voices", label: "Voices", description: "Things he is not allowed to do" },
] as const;

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
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-semibold text-[var(--color-ink)]">
          Admin
        </h1>
        <div className="flex flex-wrap items-center gap-3">
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

      <div className="space-y-6 sm:space-y-10">
        <section className="rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-6">
          <div>
            <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
              Private pages
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Admin-only tools and hidden pages.
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {privatePages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-cream)]/60 px-4 py-3 transition-colors hover:bg-[var(--color-cream-dark)]/70"
              >
                <span className="block text-sm font-semibold text-[var(--color-ink)]">
                  {page.label}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-[var(--color-muted)]">
                  {page.description}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
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
                <li key={post.slug} className="flex items-start justify-between gap-4 rounded-xl bg-[var(--color-cream)]/60 px-3 py-2 sm:bg-transparent sm:px-0 sm:py-0">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="min-w-0 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
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

        <section className="rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
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
                <li key={recipe.slug} className="flex items-start justify-between gap-4 rounded-xl bg-[var(--color-cream)]/60 px-3 py-2 sm:bg-transparent sm:px-0 sm:py-0">
                  <Link
                    href={`/recipes/${recipe.slug}`}
                    className="min-w-0 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
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
