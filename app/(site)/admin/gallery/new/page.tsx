import Link from "next/link";
import GalleryItemForm from "../GalleryItemForm";

export const metadata = {
  title: "New gallery item | Admin | Ann Symons",
  robots: "noindex, nofollow",
};

export default function NewGalleryItemPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <Link href="/admin" className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]">
        ← Admin
      </Link>
      <h1 className="mt-4 font-heading text-2xl font-semibold text-[var(--color-ink)]">
        New gallery item
      </h1>
      <GalleryItemForm />
    </div>
  );
}
