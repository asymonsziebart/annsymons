import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug, getAllPosts } from "@/lib/posts";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Post | Ann Symons" };
  return { title: `${post.title} | Ann Symons` };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-8 sm:py-20">
      <Link
        href="/blog"
        className="text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors link-accent inline-block"
      >
        ← Back to Blog
      </Link>
      <article className="mt-8 rounded-2xl bg-[var(--color-surface)] p-8 ring-1 ring-[var(--color-border)] sm:p-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          {post.title}
        </h1>
        <time
          dateTime={post.date}
          className="mt-3 block text-sm text-[var(--color-accent)]"
        >
          {new Date(post.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        <div className="mt-8 whitespace-pre-line text-[var(--color-ink-muted)] leading-relaxed">
          {post.body}
        </div>
      </article>
    </main>
  );
}
