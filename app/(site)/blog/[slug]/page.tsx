import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug, getAllPosts } from "@/lib/data/posts";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post | Ann Symons" };
  return { title: `${post.title} | Ann Symons`, robots: "noindex, nofollow" };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-20">
      <Link
        href="/blog"
        className="neo-btn !min-h-11 text-[var(--color-accent)]"
      >
        ← Back to Blog
      </Link>
      <article className="neo mt-4 p-5 sm:mt-8 sm:p-12">
        <h1 className="font-heading text-balance text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          {post.title}
        </h1>
        <time
          dateTime={post.date}
          className="mt-3 block text-sm font-bold text-[var(--color-accent)]"
        >
          {new Date(post.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        {post.image && (
          <div className="mt-6 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.image}
              alt=""
              className="w-full object-cover"
            />
          </div>
        )}
        <div className="mt-6 whitespace-pre-line text-base leading-relaxed text-[var(--color-ink-muted)] sm:mt-8">
          {post.body}
        </div>
      </article>
    </main>
  );
}
