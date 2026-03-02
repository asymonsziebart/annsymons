import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug } from "@/lib/data/posts";
import PostForm from "../../PostForm";

type Props = { params: Promise<{ slug: string }> };

export const metadata = {
  title: "Edit post | Admin | Ann Symons",
  robots: "noindex, nofollow",
};

export default async function EditPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <Link
        href="/admin"
        className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Admin
      </Link>
      <h1 className="mt-4 font-heading text-2xl font-semibold text-[var(--color-ink)]">
        Edit post
      </h1>
      <PostForm
        slug={post.slug}
        title={post.title}
        date={post.date}
        excerpt={post.excerpt}
        body={post.body}
        image={post.image}
      />
    </div>
  );
}
