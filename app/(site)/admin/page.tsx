import Link from "next/link";
import { getAllPosts } from "@/lib/data/posts";
import { getAllRecipes } from "@/lib/data/recipes";
import AdminLogoutButton from "./AdminLogoutButton";
import AdminSeedButton from "./AdminSeedButton";

const privatePages = [
  { href: "/admin/backyard", label: "Backyard Plants", description: "Map plants on a yard photo" },
  { href: "/admin/garage", label: "Garage Inventory", description: "Search bins and stored items" },
  { href: "/admin/dogs", label: "Puppy Ranch", description: "Cozy dog breeding game" },
  { href: "/admin/voices", label: "Voices", description: "Things he is not allowed to do" },
  { href: "/tasks", label: "Tasks", description: "Private task board" },
  { href: "/statephotos", label: "State Photos", description: "Map photo manager" },
  { href: "/archery", label: "Archery", description: "Hidden practice page" },
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
          <Link
            href="/admin/garage"
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Garage
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
        <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-amber-50 to-orange-50 p-5 shadow-[0_20px_60px_-38px_rgba(21,128,61,0.45)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                Game
              </p>
              <h2 className="mt-1 font-heading text-2xl font-semibold text-[var(--color-ink)]">
                Puppy Ranch
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--color-ink-muted)]">
                Buy starter dogs, breed puppies, and sell them for coins based on cuteness.
              </p>
            </div>
            <Link
              href="/admin/dogs"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
            >
              Play Puppy Ranch
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-6">
          <div>
            <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
              Private pages
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Admin-only tools and hidden pages.
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {privatePages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className={
                  page.href === "/admin/backyard"
                    ? "rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-3 shadow-sm transition-colors hover:bg-emerald-100"
                    : page.href === "/admin/garage"
                    ? "rounded-xl border border-sky-600 bg-sky-50 px-4 py-3 shadow-sm transition-colors hover:bg-sky-100"
                    : page.href === "/admin/dogs"
                    ? "rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-3 shadow-sm transition-colors hover:bg-emerald-100"
                    : page.href === "/admin/voices"
                    ? "rounded-xl border border-[var(--color-accent)] bg-orange-50 px-4 py-3 shadow-sm transition-colors hover:bg-orange-100"
                    : "rounded-xl border border-[var(--color-border)] bg-[var(--color-cream)]/60 px-4 py-3 transition-colors hover:bg-[var(--color-cream-dark)]/70"
                }
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
              Truck Fund
            </h2>
            <Link
              href="/admin/truck-fund"
              className="text-sm font-medium text-[var(--color-accent)] hover:underline"
            >
              Open →
            </Link>
          </div>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Ford Maverick down payment savings, loan estimate, and truck photo.
          </p>
        </section>

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
