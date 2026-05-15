import Link from "next/link";
import { getAllPosts } from "@/lib/data/posts";

export const metadata = {
  title: "Blog | Ann Symons",
  description: "Blog posts and updates.",
};

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-20">
      <header className="mb-8 sm:mb-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          Blog
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
          Thoughts, updates, and whatever you want to share.
        </p>
      </header>

      <ul className="space-y-4 sm:space-y-6">
        {posts.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center text-[var(--color-muted)] sm:p-8">
            No posts yet. Add entries in the{" "}
            <Link href="/admin" className="text-[var(--color-accent)] hover:underline">admin portal</Link> or{" "}
            <code className="rounded bg-[var(--color-cream-dark)] px-1.5 py-0.5 text-[var(--color-ink-muted)]">
              lib/posts.ts
            </code>
            .
          </li>
        ) : (
          posts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="card-hover block rounded-2xl bg-[var(--color-surface)] p-5 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-8"
              >
                <h2 className="font-heading text-xl font-semibold leading-snug text-[var(--color-ink)]">
                  {post.title}
                </h2>
                <time
                  dateTime={post.date}
                  className="mt-2 block text-sm text-[var(--color-accent)]"
                >
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <p className="mt-3 text-[var(--color-ink-muted)] line-clamp-2 leading-relaxed">
                  {post.excerpt}
                </p>
              </Link>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
