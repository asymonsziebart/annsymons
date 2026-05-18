"use client";

import { useMemo, useRef, useState } from "react";
import type { GarageBin } from "@/lib/data/garage";

type BarcodeDetectorLike = {
  detect: (image: HTMLImageElement) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

type WindowWithBarcodeDetector = Window & {
  BarcodeDetector?: BarcodeDetectorConstructor;
};

type SavePayload = {
  bin_code: string;
  label: string;
  photo_path: string;
  inventory_text: string;
  notes: string;
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

function searchableText(bin: GarageBin): string {
  return [
    bin.bin_code,
    bin.label ?? "",
    bin.inventory_text,
    bin.notes ?? "",
  ]
    .join("\n")
    .toLowerCase();
}

async function scanQrFromImageUrl(url: string): Promise<string | null> {
  const Detector = (window as WindowWithBarcodeDetector).BarcodeDetector;
  if (!Detector) return null;

  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();

  const detector = new Detector({ formats: ["qr_code"] });
  const results = await detector.detect(image);
  return results[0]?.rawValue?.trim() || null;
}

export default function GarageInventoryApp({ initialBins }: { initialBins: GarageBin[] }) {
  const [bins, setBins] = useState(initialBins);
  const [query, setQuery] = useState("");
  const [binCode, setBinCode] = useState("");
  const [label, setLabel] = useState("");
  const [photoPath, setPhotoPath] = useState("");
  const [inventoryText, setInventoryText] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredBins = useMemo(() => {
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (terms.length === 0) return bins;
    return bins.filter((bin) => {
      const haystack = searchableText(bin);
      return terms.every((term) => haystack.includes(term));
    });
  }, [bins, query]);

  function resetForm() {
    setBinCode("");
    setLabel("");
    setPhotoPath("");
    setInventoryText("");
    setNotes("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function editBin(bin: GarageBin) {
    setBinCode(bin.bin_code);
    setLabel(bin.label ?? "");
    setPhotoPath(bin.photo_path ?? "");
    setInventoryText(bin.inventory_text);
    setNotes(bin.notes ?? "");
    setStatus(`Editing bin ${bin.bin_code}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refreshBins() {
    const res = await fetch("/api/admin/garage");
    const data = (await res.json()) as { bins?: GarageBin[]; error?: string };
    if (!res.ok) throw new Error(data.error || "Failed to refresh garage bins");
    setBins(data.bins ?? []);
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    setStatus("Uploading garage photo...");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("folder", "garage");
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok || !data.path) throw new Error(data.error || "Upload failed");
      setPhotoPath(data.path);
      setStatus("Photo uploaded. Looking for a QR code...");
      try {
        const qr = await scanQrFromImageUrl(data.path);
        if (qr) {
          setBinCode(qr);
          setStatus(`Photo uploaded and QR code found: ${qr}`);
        } else {
          setStatus("Photo uploaded. No QR code found; type or scan the bin code.");
        }
      } catch {
        setStatus("Photo uploaded. QR scanning failed in this browser; type the bin code.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadPhoto(file);
  }

  async function analyzePhoto() {
    if (!photoPath) {
      setStatus("Upload a bin photo before running AI inventory.");
      return;
    }
    setAnalyzing(true);
    setStatus("Asking AI to inventory the bin...");
    try {
      const res = await fetch("/api/admin/garage/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_path: photoPath, bin_code: binCode }),
      });
      const data = (await res.json()) as {
        inventory_text?: string;
        configured?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "AI inventory failed");
      setInventoryText(data.inventory_text ?? "");
      setStatus(
        data.configured === false
          ? "AI is not configured yet. Add OPENAI_API_KEY to enable automatic inventory."
          : "AI inventory draft added. Review and save it."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI inventory failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveBin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: SavePayload = {
      bin_code: binCode.trim(),
      label: label.trim(),
      photo_path: photoPath.trim(),
      inventory_text: inventoryText.trim(),
      notes: notes.trim(),
    };
    if (!payload.bin_code) {
      setStatus("Bin code is required. Scan a QR code or type it in.");
      return;
    }

    setSaving(true);
    setStatus("Saving garage bin...");
    try {
      const res = await fetch("/api/admin/garage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { bin?: GarageBin; error?: string };
      if (!res.ok || !data.bin) throw new Error(data.error || "Failed to save garage bin");
      await refreshBins();
      resetForm();
      setStatus(`Saved bin ${data.bin.bin_code}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save garage bin");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBin(id: number) {
    if (!window.confirm("Delete this garage bin from the inventory?")) return;
    setStatus("Deleting garage bin...");
    try {
      const res = await fetch(`/api/admin/garage/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to delete garage bin");
      await refreshBins();
      setStatus("Garage bin deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete garage bin");
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
      <section className="rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-6">
        <h2 className="font-heading text-xl font-semibold text-[var(--color-ink)]">
          Add or update a bin
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
          Upload a photo, scan the QR code if the browser supports it, then save the inventory text.
        </p>

        <form onSubmit={saveBin} className="mt-5 space-y-4">
          <div>
            <label htmlFor="garage-photo" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
              Bin photo
            </label>
            <input
              ref={fileRef}
              id="garage-photo"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={onFileChange}
              disabled={uploading}
              className="w-full rounded-xl border border-dashed border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink-muted)]"
            />
          </div>

          {photoPath ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-cream)]/60">
              <img src={photoPath} alt="Uploaded garage bin" className="max-h-64 w-full object-cover" />
              <p className="px-3 py-2 text-xs text-[var(--color-muted)]">{photoPath}</p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bin-code" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
                QR / bin code
              </label>
              <input
                id="bin-code"
                value={binCode}
                onChange={(event) => setBinCode(event.target.value)}
                placeholder="BIN-001"
                className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                required
              />
            </div>
            <div>
              <label htmlFor="bin-label" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
                Label
              </label>
              <input
                id="bin-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Holiday decor"
                className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label htmlFor="inventory-text" className="block text-sm font-medium text-[var(--color-ink-muted)]">
                Inventory
              </label>
              <button
                type="button"
                onClick={analyzePhoto}
                disabled={analyzing || !photoPath}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analyzing ? "Analyzing..." : "AI inventory from photo"}
              </button>
            </div>
            <textarea
              id="inventory-text"
              value={inventoryText}
              onChange={(event) => setInventoryText(event.target.value)}
              rows={8}
              placeholder={"One item per line works best:\nChristmas lights\nExtension cords\nCamping stove"}
              className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>

          <div>
            <label htmlFor="garage-notes" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
              Notes
            </label>
            <textarea
              id="garage-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Shelf, location, or reminders"
              className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving || uploading}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save bin"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)]"
            >
              Clear
            </button>
          </div>
        </form>

        {status ? (
          <p className="mt-4 rounded-xl bg-[var(--color-cream)] px-4 py-3 text-sm text-[var(--color-ink-muted)]">
            {status}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold text-[var(--color-ink)]">
              Search bins
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Search bin codes, labels, notes, and inventory.
            </p>
          </div>
          <span className="rounded-full bg-[var(--color-cream-dark)] px-3 py-1 text-sm font-semibold text-[var(--color-ink-muted)]">
            {filteredBins.length} / {bins.length}
          </span>
        </div>

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for extension cords, holiday, BIN-001..."
          className="mt-4 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />

        {filteredBins.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-cream)]/60 px-4 py-8 text-center text-sm text-[var(--color-muted)]">
            No bins match yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {filteredBins.map((bin) => (
              <li
                key={bin.id}
                className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-cream)]/50"
              >
                {bin.photo_path ? (
                  <img src={bin.photo_path} alt="" className="h-44 w-full object-cover" loading="lazy" />
                ) : null}
                <div className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                        {bin.label || bin.bin_code}
                      </h3>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                        {bin.bin_code}
                      </p>
                      {bin.updated_at ? (
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          Updated {formatDate(bin.updated_at)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => editBin(bin)}
                        className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteBin(bin.id)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {bin.inventory_text ? (
                    <div className="mt-4 rounded-xl bg-white px-3 py-3 text-sm text-[var(--color-ink-muted)]">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                        Inventory
                      </p>
                      <p className="whitespace-pre-line">{bin.inventory_text}</p>
                    </div>
                  ) : null}

                  {bin.notes ? (
                    <p className="mt-3 text-sm text-[var(--color-muted)]">{bin.notes}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
