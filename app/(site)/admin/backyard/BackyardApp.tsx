"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BackyardPhoto, PlantPin } from "@/lib/data/backyard";

type Props = {
  initialPhotos: BackyardPhoto[];
  initialPins: PlantPin[];
};

type PendingPin = {
  x_pct: number;
  y_pct: number;
};

function searchableText(pin: PlantPin, photoTitle: string): string {
  return [
    pin.plant_name,
    pin.common_name ?? "",
    pin.species ?? "",
    pin.notes ?? "",
    pin.planted_year?.toString() ?? "",
    photoTitle,
  ]
    .join("\n")
    .toLowerCase();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BackyardApp({ initialPhotos, initialPins }: Props) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [pins, setPins] = useState(initialPins);
  const [activePhotoId, setActivePhotoId] = useState<number | null>(
    initialPhotos[0]?.id ?? null
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);
  const [editingPinId, setEditingPinId] = useState<number | null>(null);

  const [photoTitle, setPhotoTitle] = useState("");
  const [plantName, setPlantName] = useState("");
  const [commonName, setCommonName] = useState("");
  const [species, setSpecies] = useState("");
  const [plantedYear, setPlantedYear] = useState("");
  const [notes, setNotes] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const activePhoto = photos.find((p) => p.id === activePhotoId) ?? null;

  const photoTitleById = useMemo(() => {
    const map = new Map<number, string>();
    for (const photo of photos) {
      map.set(photo.id, photo.title || `Photo ${photo.id}`);
    }
    return map;
  }, [photos]);

  const pinsForActivePhoto = useMemo(
    () => pins.filter((pin) => pin.photo_id === activePhotoId),
    [pins, activePhotoId]
  );

  const filteredPins = useMemo(() => {
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (terms.length === 0) return pins;
    return pins.filter((pin) => {
      const haystack = searchableText(pin, photoTitleById.get(pin.photo_id) ?? "");
      return terms.every((term) => haystack.includes(term));
    });
  }, [pins, query, photoTitleById]);

  function resetPinForm() {
    setPendingPin(null);
    setEditingPinId(null);
    setPlantName("");
    setCommonName("");
    setSpecies("");
    setPlantedYear("");
    setNotes("");
  }

  async function refreshData() {
    const res = await fetch("/api/admin/backyard");
    const data = (await res.json()) as {
      photos?: BackyardPhoto[];
      pins?: PlantPin[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || "Failed to refresh backyard data");
    setPhotos(data.photos ?? []);
    setPins(data.pins ?? []);
    if (!data.photos?.some((p) => p.id === activePhotoId)) {
      setActivePhotoId(data.photos?.[0]?.id ?? null);
    }
  }

  useEffect(() => {
    void refreshData().catch((error) => {
      setStatus(error instanceof Error ? error.message : "Failed to load backyard data");
    });
  }, []);

  async function uploadPhoto(file: File) {
    setUploading(true);
    setStatus("Uploading backyard photo...");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("folder", "backyard");
      const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: form });
      const uploadData = (await uploadRes.json()) as { path?: string; error?: string };
      if (!uploadRes.ok || !uploadData.path) {
        throw new Error(uploadData.error || "Upload failed");
      }

      const saveRes = await fetch("/api/admin/backyard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "photo",
          title: photoTitle.trim() || null,
          photo_path: uploadData.path,
        }),
      });
      const saveData = (await saveRes.json()) as { photo?: BackyardPhoto; error?: string };
      if (!saveRes.ok || !saveData.photo) {
        throw new Error(saveData.error || "Failed to save photo");
      }

      await refreshData();
      setActivePhotoId(saveData.photo.id);
      setPhotoTitle("");
      if (fileRef.current) fileRef.current.value = "";
      setStatus("Backyard photo uploaded. Click Add pin mode, then tap where you planted something.");
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

  function onMapClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!addMode || !activePhoto || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x_pct = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y_pct = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    setPendingPin({ x_pct, y_pct });
    setEditingPinId(null);
    setPlantName("");
    setCommonName("");
    setSpecies("");
    setPlantedYear("");
    setNotes("");
    setStatus("New pin placed. Fill in the plant details and save.");
  }

  function startEditPin(pin: PlantPin) {
    setSelectedPinId(pin.id);
    setEditingPinId(pin.id);
    setPendingPin({ x_pct: pin.x_pct, y_pct: pin.y_pct });
    setPlantName(pin.plant_name);
    setCommonName(pin.common_name ?? "");
    setSpecies(pin.species ?? "");
    setPlantedYear(pin.planted_year?.toString() ?? "");
    setNotes(pin.notes ?? "");
    if (pin.photo_id !== activePhotoId) {
      setActivePhotoId(pin.photo_id);
    }
    setStatus(`Editing ${pin.plant_name}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function savePin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePhoto || !pendingPin) {
      setStatus("Place a pin on the photo first.");
      return;
    }
    if (!plantName.trim()) {
      setStatus("Plant name is required.");
      return;
    }

    setSaving(true);
    setStatus(editingPinId ? "Updating plant pin..." : "Saving plant pin...");
    try {
      if (editingPinId) {
        const res = await fetch(`/api/admin/backyard/${editingPinId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plant_name: plantName.trim(),
            common_name: commonName.trim() || null,
            species: species.trim() || null,
            planted_year: plantedYear.trim() ? Number(plantedYear) : null,
            notes: notes.trim() || null,
            x_pct: pendingPin.x_pct,
            y_pct: pendingPin.y_pct,
          }),
        });
        const data = (await res.json()) as { pin?: PlantPin; error?: string };
        if (!res.ok || !data.pin) throw new Error(data.error || "Failed to update pin");
      } else {
        const res = await fetch("/api/admin/backyard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "pin",
            photo_id: activePhoto.id,
            x_pct: pendingPin.x_pct,
            y_pct: pendingPin.y_pct,
            plant_name: plantName.trim(),
            common_name: commonName.trim() || null,
            species: species.trim() || null,
            planted_year: plantedYear.trim() ? Number(plantedYear) : null,
            notes: notes.trim() || null,
          }),
        });
        const data = (await res.json()) as { pin?: PlantPin; error?: string };
        if (!res.ok || !data.pin) throw new Error(data.error || "Failed to save pin");
      }

      await refreshData();
      resetPinForm();
      setAddMode(false);
      setStatus("Plant pin saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save plant pin");
    } finally {
      setSaving(false);
    }
  }

  async function deletePin(id: number) {
    if (!window.confirm("Delete this plant pin?")) return;
    setStatus("Deleting plant pin...");
    try {
      const res = await fetch(`/api/admin/backyard/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to delete pin");
      if (selectedPinId === id) setSelectedPinId(null);
      if (editingPinId === id) resetPinForm();
      await refreshData();
      setStatus("Plant pin deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete pin");
    }
  }

  async function deletePhoto(id: number) {
    if (!window.confirm("Delete this backyard photo and all its pins?")) return;
    setStatus("Deleting backyard photo...");
    try {
      const res = await fetch(`/api/admin/backyard/${id}?kind=photo`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to delete photo");
      resetPinForm();
      await refreshData();
      setStatus("Backyard photo deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete photo");
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
      <section className="rounded-2xl bg-[var(--color-surface)] p-4 shadow-[0_16px_42px_-32px_rgba(28,25,23,0.55)] ring-1 ring-[var(--color-border)] sm:p-6">
        <h2 className="font-heading text-xl font-semibold text-[var(--color-ink)]">
          Backyard map
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
          Upload a photo of your yard, turn on add-pin mode, and click where each plant lives.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="backyard-title" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
              Photo label (optional)
            </label>
            <input
              id="backyard-title"
              value={photoTitle}
              onChange={(event) => setPhotoTitle(event.target.value)}
              placeholder="Summer 2026 backyard"
              className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>

          <div>
            <label htmlFor="backyard-photo" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
              Upload backyard photo
            </label>
            <input
              ref={fileRef}
              id="backyard-photo"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={onFileChange}
              disabled={uploading}
              className="w-full rounded-xl border border-dashed border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink-muted)]"
            />
          </div>

          {photos.length > 0 ? (
            <div>
              <label htmlFor="active-photo" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
                Active photo
              </label>
              <div className="flex gap-2">
                <select
                  id="active-photo"
                  value={activePhotoId ?? ""}
                  onChange={(event) => {
                    setActivePhotoId(Number(event.target.value));
                    resetPinForm();
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                >
                  {photos.map((photo) => (
                    <option key={photo.id} value={photo.id}>
                      {photo.title || `Photo ${photo.id}`}
                    </option>
                  ))}
                </select>
                {activePhoto ? (
                  <button
                    type="button"
                    onClick={() => void deletePhoto(activePhoto.id)}
                    className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {activePhoto ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddMode((value) => !value);
                    if (addMode) resetPinForm();
                  }}
                  className={
                    addMode
                      ? "rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                      : "rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                  }
                >
                  {addMode ? "Add pin mode on" : "Add pin mode"}
                </button>
                {addMode ? (
                  <span className="self-center text-sm text-[var(--color-muted)]">
                    Click the photo to place a pin
                  </span>
                ) : null}
              </div>

              <div
                ref={mapRef}
                onClick={onMapClick}
                className={
                  addMode
                    ? "relative cursor-crosshair overflow-hidden rounded-2xl border-2 border-emerald-400 bg-[var(--color-cream)]/60"
                    : "relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-cream)]/60"
                }
              >
                <img
                  src={activePhoto.photo_path}
                  alt={activePhoto.title || "Backyard photo"}
                  className="block w-full select-none"
                  draggable={false}
                />
                {pinsForActivePhoto.map((pin) => {
                  const isSelected = selectedPinId === pin.id;
                  const isPending =
                    pendingPin &&
                    editingPinId === pin.id &&
                    Math.abs(pendingPin.x_pct - pin.x_pct) < 0.01 &&
                    Math.abs(pendingPin.y_pct - pin.y_pct) < 0.01;
                  return (
                    <button
                      key={pin.id}
                      type="button"
                      title={pin.plant_name}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedPinId(pin.id);
                        startEditPin(pin);
                      }}
                      className={
                        isSelected || isPending
                          ? "absolute z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-500 shadow-lg ring-2 ring-amber-300"
                          : "absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-600 shadow-md hover:scale-110"
                      }
                      style={{ left: `${pin.x_pct}%`, top: `${pin.y_pct}%` }}
                    />
                  );
                })}
                {pendingPin && !editingPinId ? (
                  <span
                    className="absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-500 shadow-lg ring-2 ring-amber-300"
                    style={{ left: `${pendingPin.x_pct}%`, top: `${pendingPin.y_pct}%` }}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-cream)]/60 px-4 py-8 text-center text-sm text-[var(--color-muted)]">
              Upload a backyard photo to start placing plant pins.
            </p>
          )}

          {pendingPin ? (
            <form onSubmit={savePin} className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-cream)]/40 p-4">
              <h3 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                {editingPinId ? "Edit plant pin" : "New plant pin"}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="plant-name" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
                    Plant name
                  </label>
                  <input
                    id="plant-name"
                    value={plantName}
                    onChange={(event) => setPlantName(event.target.value)}
                    placeholder="Tomato"
                    required
                    className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label htmlFor="common-name" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
                    Common name
                  </label>
                  <input
                    id="common-name"
                    value={commonName}
                    onChange={(event) => setCommonName(event.target.value)}
                    placeholder="Cherry tomato"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="species" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
                    Species / variety
                  </label>
                  <input
                    id="species"
                    value={species}
                    onChange={(event) => setSpecies(event.target.value)}
                    placeholder="Solanum lycopersicum"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label htmlFor="planted-year" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
                    Planted year
                  </label>
                  <input
                    id="planted-year"
                    type="number"
                    min={1900}
                    max={2100}
                    value={plantedYear}
                    onChange={(event) => setPlantedYear(event.target.value)}
                    placeholder="2026"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="plant-notes" className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
                  Notes
                </label>
                <textarea
                  id="plant-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="North bed, gets afternoon sun"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingPinId ? "Update pin" : "Save pin"}
                </button>
                <button
                  type="button"
                  onClick={resetPinForm}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)]"
                >
                  Cancel
                </button>
                {editingPinId ? (
                  <button
                    type="button"
                    onClick={() => void deletePin(editingPinId)}
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}
        </div>

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
              Search plants
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Search by name, species, notes, or year planted.
            </p>
          </div>
          <span className="rounded-full bg-[var(--color-cream-dark)] px-3 py-1 text-sm font-semibold text-[var(--color-ink-muted)]">
            {filteredPins.length} / {pins.length}
          </span>
        </div>

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tomato, hydrangea, north bed..."
          className="mt-4 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />

        {filteredPins.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-cream)]/60 px-4 py-8 text-center text-sm text-[var(--color-muted)]">
            {pins.length === 0 ? "No plant pins yet." : "No plants match your search."}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {filteredPins.map((pin) => (
              <li
                key={pin.id}
                className={
                  selectedPinId === pin.id
                    ? "rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4"
                    : "rounded-2xl border border-[var(--color-border)] bg-[var(--color-cream)]/50 p-4"
                }
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <button
                    type="button"
                    onClick={() => startEditPin(pin)}
                    className="text-left"
                  >
                    <h3 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                      {pin.plant_name}
                    </h3>
                    {pin.common_name ? (
                      <p className="mt-1 text-sm text-[var(--color-muted)]">{pin.common_name}</p>
                    ) : null}
                    {pin.species ? (
                      <p className="mt-1 text-xs italic text-[var(--color-muted)]">{pin.species}</p>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditPin(pin)}
                    className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)]"
                  >
                    View on map
                  </button>
                </div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {photoTitleById.get(pin.photo_id) ?? "Backyard photo"}
                </p>
                {pin.planted_year ? (
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                    Planted {pin.planted_year}
                  </p>
                ) : null}
                {pin.notes ? (
                  <p className="mt-2 text-sm text-[var(--color-muted)]">{pin.notes}</p>
                ) : null}
                {pin.created_at ? (
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    Added {formatDate(pin.created_at)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
