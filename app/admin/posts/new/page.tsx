import Link from "next/link";
import PostForm from "../PostForm";

export const metadata = {
  title: "New post | Admin | Ann Symons",
  robots: "noindex, nofollow",
};

export default function NewPostPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <Link
        href="/admin"
        className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Admin
      </Link>
      <h1 className="mt-4 font-heading text-2xl font-semibold text-[var(--color-ink)]">
        New post
      </h1>
      <PostForm />
    </div>
  );
}
