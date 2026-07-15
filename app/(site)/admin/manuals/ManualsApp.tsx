"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { ManualDocument, ManualItem } from "@/lib/data/manuals";

type Props = {
  initialManuals: ManualItem[];
  dbReady: boolean;
};

type FormState = {
  slug: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  location: string;
  support_url: string;
  notes: string;
  documents: ManualDocument[];
};

const EMPTY_FORM: FormState = {
  slug: "",
  name: "",
  brand: "",
  model: "",
  category: "",
  location: "",
  support_url: "",
  notes: "",
  documents: [{ label: "User's Guide", url: "" }],
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function searchableText(item: ManualItem): string {
  return [
    item.name,
    item.brand ?? "",
    item.model ?? "",
    item.category ?? "",
    item.location ?? "",
    item.notes ?? "",
    ...item.documents.map((doc) => `${doc.label} ${doc.url}`),
  ]
    .join("\n")
    .toLowerCase();
}

function metaLine(item: ManualItem): string {
  return [item.brand, item.model, item.category].filter(Boolean).join(" · ");
}

export default function ManualsApp({ initialManuals, dbReady }: Props) {
  const [manuals, setManuals] = useState(initialManuals);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (terms.length === 0) return manuals;
    return manuals.filter((item) => {
      const haystack = searchableText(item);
      return terms.every((term) => haystack.includes(term));
    });
  }, [manuals, query]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of manuals) {
      if (item.category) set.add(item.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [manuals]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function editManual(item: ManualItem) {
    setEditingId(item.id);
    setForm({
      slug: item.slug,
      name: item.name,
      brand: item.brand ?? "",
      model: item.model ?? "",
      category: item.category ?? "",
      location: item.location ?? "",
      support_url: item.support_url ?? "",
      notes: item.notes ?? "",
      documents:
        item.documents.length > 0
          ? item.documents.map((doc) => ({ ...doc }))
          : [{ label: "User's Guide", url: "" }],
    });
    setShowForm(true);
    setStatus(`Editing ${item.name}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateDocument(index: number, field: keyof ManualDocument, value: string) {
    setForm((prev) => ({
      ...prev,
      documents: prev.documents.map((doc, i) =>
        i === index ? { ...doc, [field]: value } : doc
      ),
    }));
  }

  function addDocumentRow() {
    setForm((prev) => ({
      ...prev,
      documents: [...prev.documents, { label: "", url: "" }],
    }));
  }

  function removeDocumentRow(index: number) {
    setForm((prev) => ({
      ...prev,
      documents:
        prev.documents.length <= 1
          ? [{ label: "", url: "" }]
          : prev.documents.filter((_, i) => i !== index),
    }));
  }

  async function saveManual(event: FormEvent) {
    event.preventDefault();
    if (!dbReady) {
      setStatus("Database is not configured, so manuals cannot be saved yet.");
      return;
    }
    const name = form.name.trim();
    if (!name) {
      setStatus("Name is required.");
      return;
    }
    const documents = form.documents
      .map((doc) => ({ label: doc.label.trim(), url: doc.url.trim() }))
      .filter((doc) => doc.label && doc.url);
    if (documents.length === 0) {
      setStatus("Add at least one document with a label and URL.");
      return;
    }

    setSaving(true);
    setStatus("Saving…");
    try {
      const res = await fetch("/api/admin/manuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: form.slug.trim() || undefined,
          name,
          brand: form.brand.trim(),
          model: form.model.trim(),
          category: form.category.trim(),
          location: form.location.trim(),
          support_url: form.support_url.trim(),
          notes: form.notes.trim(),
          documents,
        }),
      });
      const data = (await res.json()) as { manual?: ManualItem; error?: string };
      if (!res.ok || !data.manual) {
        throw new Error(data.error || "Failed to save manual");
      }
      setManuals((prev) => {
        const without = prev.filter(
          (item) => item.id !== data.manual!.id && item.slug !== data.manual!.slug
        );
        return [...without, data.manual!].sort((a, b) => a.name.localeCompare(b.name));
      });
      resetForm();
      setShowForm(false);
      setStatus(`Saved ${data.manual.name}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save manual");
    } finally {
      setSaving(false);
    }
  }

  async function removeManual(item: ManualItem) {
    if (!dbReady) {
      setStatus("Database is not configured, so manuals cannot be deleted yet.");
      return;
    }
    if (!window.confirm(`Remove “${item.name}” from manuals?`)) return;
    setStatus("Removing…");
    try {
      const res = await fetch(`/api/admin/manuals/${item.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to delete manual");
      setManuals((prev) => prev.filter((m) => m.id !== item.id));
      if (editingId === item.id) {
        resetForm();
        setShowForm(false);
      }
      setStatus(`Removed ${item.name}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete manual");
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="block min-w-0 flex-1">
            <span className="text-sm font-medium text-[var(--color-ink-muted)]">Search manuals</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Brand, model, category, notes…"
              className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (showForm && editingId === null) {
                setShowForm(false);
                resetForm();
                return;
              }
              resetForm();
              setShowForm(true);
              setStatus("");
            }}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800"
          >
            {showForm && editingId === null ? "Cancel" : "+ Add manual"}
          </button>
        </div>

        {categories.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setQuery("")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                !query
                  ? "bg-teal-700 text-white"
                  : "bg-[var(--color-cream)] text-[var(--color-ink-muted)] hover:bg-[var(--color-cream-dark)]"
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setQuery(category)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  query.trim().toLowerCase() === category.toLowerCase()
                    ? "bg-teal-700 text-white"
                    : "bg-[var(--color-cream)] text-[var(--color-ink-muted)] hover:bg-[var(--color-cream-dark)]"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        ) : null}

        {status ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]" role="status">
            {status}
          </p>
        ) : null}
        {!dbReady ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            DATABASE_URL is not set, so new manuals cannot be saved yet. Seeded entries still show when
            the database is connected.
          </p>
        ) : null}
      </div>

      {showForm ? (
        <form
          onSubmit={saveManual}
          className="rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-6"
        >
          <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
            {editingId ? "Edit manual" : "Add manual"}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Store product name, model, and PDF or support links so you can find them later.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-[var(--color-ink-muted)]">Name</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Brother LS-2125i Sewing Machine"
                className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[var(--color-ink-muted)]">Brand</span>
              <input
                value={form.brand}
                onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))}
                placeholder="Brother"
                className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[var(--color-ink-muted)]">Model</span>
              <input
                value={form.model}
                onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                placeholder="LS-2125i"
                className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[var(--color-ink-muted)]">Category</span>
              <input
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="Sewing"
                list="manual-categories"
                className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
              <datalist id="manual-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[var(--color-ink-muted)]">Where it lives</span>
              <input
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Craft room closet"
                className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-[var(--color-ink-muted)]">Support page URL</span>
              <input
                type="url"
                value={form.support_url}
                onChange={(e) => setForm((prev) => ({ ...prev, support_url: e.target.value }))}
                placeholder="https://support.brother.com/..."
                className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </label>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">Documents</h3>
              <button
                type="button"
                onClick={addDocumentRow}
                className="text-sm font-medium text-teal-700 hover:underline"
              >
                + Add link
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {form.documents.map((doc, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-cream)]/50 p-3 sm:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)_auto]"
                >
                  <input
                    value={doc.label}
                    onChange={(e) => updateDocument(index, "label", e.target.value)}
                    placeholder="User's Guide"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                  <input
                    type="url"
                    value={doc.url}
                    onChange={(e) => updateDocument(index, "url", e.target.value)}
                    placeholder="https://…/manual.pdf"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeDocumentRow(index)}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-[var(--color-ink-muted)]">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Anything useful to remember later…"
              className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || !dbReady}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Save manual"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
                setStatus("");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <section className="rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
            Your manuals
          </h2>
          <p className="text-sm text-[var(--color-muted)]">
            {filtered.length} of {manuals.length}
          </p>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-cream)]/60 px-4 py-8 text-center text-sm text-[var(--color-muted)]">
            {manuals.length === 0
              ? "No manuals yet. Add one to get started."
              : "No manuals match that search."}
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {filtered.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-cream)]/60 px-4 py-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                      {item.name}
                    </h3>
                    {metaLine(item) ? (
                      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{metaLine(item)}</p>
                    ) : null}
                    {item.location ? (
                      <p className="mt-1 text-sm text-[var(--color-muted)]">Location: {item.location}</p>
                    ) : null}
                    {item.notes ? (
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink-muted)]">
                        {item.notes}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.documents.map((doc) => (
                        <a
                          key={`${doc.label}-${doc.url}`}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                        >
                          {doc.label}
                        </a>
                      ))}
                      {item.support_url ? (
                        <a
                          href={item.support_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50"
                        >
                          Support page
                        </a>
                      ) : null}
                    </div>

                    {item.updated_at ? (
                      <p className="mt-3 text-xs text-[var(--color-muted)]">
                        Updated {formatDate(item.updated_at)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                    <button
                      type="button"
                      onClick={() => editManual(item)}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink-muted)] hover:bg-white/80"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeManual(item)}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
