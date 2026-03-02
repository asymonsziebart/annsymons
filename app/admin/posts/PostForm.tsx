"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  slug?: string;
  title?: string;
  date?: string;
  excerpt?: string;
  body?: string;
};

export default function PostForm({ slug: initialSlug, title: initialTitle, date: initialDate, excerpt: initialExcerpt, body: initialBody }: Props) {
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [title, setTitle] = useState(initialTitle ?? "");
  const [date, setDate] = useState(initialDate ?? new Date().toISOString().slice(0, 10));
  const [excerpt, setExcerpt] = useState(initialExcerpt ?? "");
  const [body, setBody] = useState(initialBody ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const isEdit = !!initialSlug;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = isEdit ? `/api/admin/posts/${initialSlug}` : "/api/admin/posts";
      const method = isEdit ? "PUT" : "POST";
      const payload = isEdit
        ? { title, date, excerpt, body }
        : { slug, title, date, excerpt, body };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const inputClass =
    "w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {!isEdit && (
        <div>
          <label htmlFor="slug" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
            Slug (URL path, e.g. my-post)
          </label>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
            required
          />
        </div>
      )}
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label htmlFor="date" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
          Date
        </label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="excerpt" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
          Excerpt (short summary)
        </label>
        <input
          id="excerpt"
          type="text"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="body" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
          Body
        </label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          className={inputClass}
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {loading ? "Saving…" : isEdit ? "Update post" : "Create post"}
        </button>
        <Link
          href="/admin"
          className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
