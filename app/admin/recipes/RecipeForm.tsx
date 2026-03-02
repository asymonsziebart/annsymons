"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Recipe } from "@/lib/recipes";

type Props = Partial<Recipe>;

export default function RecipeForm(initial: Props) {
  const [slug, setSlug] = useState(initial.slug ?? "");
  const [title, setTitle] = useState(initial.title ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [prepTime, setPrepTime] = useState(initial.prepTime ?? "");
  const [cookTime, setCookTime] = useState(initial.cookTime ?? "");
  const [servings, setServings] = useState(initial.servings ?? "");
  const [ingredientsText, setIngredientsText] = useState((initial.ingredients ?? []).join("\n"));
  const [stepsText, setStepsText] = useState((initial.steps ?? []).join("\n"));
  const [image, setImage] = useState(initial.image ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const isEdit = !!initial.slug;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const ingredients = ingredientsText.trim().split("\n").filter(Boolean);
    const steps = stepsText.trim().split("\n").filter(Boolean);
    try {
      const url = isEdit ? `/api/admin/recipes/${initial.slug}` : "/api/admin/recipes";
      const method = isEdit ? "PUT" : "POST";
      const payload = isEdit
        ? { title, description, prepTime, cookTime, servings, ingredients, steps, image }
        : { slug, title, description, prepTime, cookTime, servings, ingredients, steps, image };
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
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">Slug (URL)</label>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} required />
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">Description</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">Prep time</label>
          <input type="text" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} className={inputClass} placeholder="e.g. 15 min" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">Cook time</label>
          <input type="text" value={cookTime} onChange={(e) => setCookTime(e.target.value)} className={inputClass} placeholder="e.g. 30 min" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">Servings</label>
          <input type="text" value={servings} onChange={(e) => setServings(e.target.value)} className={inputClass} placeholder="e.g. 4" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">Ingredients (one per line)</label>
        <textarea value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} rows={8} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">Steps (one per line)</label>
        <textarea value={stepsText} onChange={(e) => setStepsText(e.target.value)} rows={8} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">Image URL (e.g. /recipes/photo.webp)</label>
        <input type="text" value={image} onChange={(e) => setImage(e.target.value)} className={inputClass} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50">
          {loading ? "Saving…" : isEdit ? "Update recipe" : "Create recipe"}
        </button>
        <Link href="/admin" className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)]">Cancel</Link>
      </div>
    </form>
  );
}
