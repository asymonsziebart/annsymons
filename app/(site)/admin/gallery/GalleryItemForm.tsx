"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GalleryItem } from "@/lib/gallery";
import ImageUploadField from "../ImageUploadField";

type Props = Partial<GalleryItem> & { id?: string };

export default function GalleryItemForm(initial: Props) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [src, setSrc] = useState(initial.src ?? "");
  const [type, setType] = useState<"image" | "file">((initial.type as "image" | "file") ?? "image");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const isEdit = !!initial.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = isEdit ? `/api/admin/gallery/${initial.id}` : "/api/admin/gallery";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, src, type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "neo-input";

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">Description (optional)</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </div>
      <ImageUploadField folder="gallery" value={src} onChange={setSrc} label="Image (src)" inputClass={inputClass} required />
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value as "image" | "file")} className={inputClass}>
          <option value="image">image</option>
          <option value="file">file</option>
        </select>
      </div>
      {error && <p className="text-sm text-[var(--color-accent)]">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={loading} className="neo-btn-primary disabled:opacity-50">
          {loading ? "Saving…" : isEdit ? "Update" : "Create"}
        </button>
        <Link href="/admin" className="neo-btn">Cancel</Link>
      </div>
    </form>
  );
}
