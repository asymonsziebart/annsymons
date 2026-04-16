import Link from "next/link";
import { notFound } from "next/navigation";
import { getGalleryItemById } from "@/lib/data/gallery";
import GalleryItemForm from "../../GalleryItemForm";

type Props = { params: Promise<{ id: string }> };

export const metadata = {
  title: "Edit gallery item | Admin | Ann Symons",
  robots: "noindex, nofollow",
};

export default async function EditGalleryItemPage({ params }: Props) {
  const { id } = await params;
  const item = await getGalleryItemById(id);
  if (!item) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <Link href="/admin" className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]">
        ← Admin
      </Link>
      <h1 className="mt-4 font-heading text-2xl font-semibold text-[var(--color-ink)]">
        Edit gallery item
      </h1>
      <GalleryItemForm {...item} />
    </div>
  );
}
