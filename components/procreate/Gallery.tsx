"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArtworkMeta } from "@/lib/procreate/types";
import { CANVAS_PRESETS } from "@/lib/procreate/brushes";
import { deleteArtwork, duplicateArtwork, listArtworks } from "@/lib/procreate/storage";
import { IconPlus } from "./icons";

type Props = {
  onOpen: (id: string) => void;
  onCreate: (name: string, width: number, height: number) => void;
};

export default function Gallery({ onOpen, onCreate }: Props) {
  const [artworks, setArtworks] = useState<ArtworkMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("Untitled Artwork");
  const [presetId, setPresetId] = useState(CANVAS_PRESETS[2].id);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listArtworks();
    setArtworks(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const preset = CANVAS_PRESETS.find((p) => p.id === presetId) ?? CANVAS_PRESETS[2];

  function handleCreate() {
    onCreate(name.trim() || "Untitled Artwork", preset.width, preset.height);
    setShowNew(false);
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this artwork?")) return;
    await deleteArtwork(id);
    void refresh();
  }

  async function handleDuplicate(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await duplicateArtwork(id);
    void refresh();
  }

  return (
    <div className="procreate-gallery">
      <header className="procreate-gallery-header">
        <div>
          <h1>Gallery</h1>
          <p>Select artwork or create a new canvas</p>
        </div>
        <button type="button" className="procreate-btn-primary" onClick={() => setShowNew(true)}>
          <IconPlus className="h-5 w-5" />
          New canvas
        </button>
      </header>

      {loading ? (
        <p className="procreate-muted">Loading your gallery…</p>
      ) : artworks.length === 0 ? (
        <div className="procreate-gallery-empty">
          <div className="procreate-gallery-empty-icon">+</div>
          <h2>No artwork yet</h2>
          <p>Tap New canvas to start creating — just like Procreate on iPad.</p>
          <button type="button" className="procreate-btn-primary" onClick={() => setShowNew(true)}>
            Create your first canvas
          </button>
        </div>
      ) : (
        <div className="procreate-gallery-grid">
          {artworks.map((art) => (
            <button
              key={art.id}
              type="button"
              className="procreate-gallery-card"
              onClick={() => onOpen(art.id)}
            >
              <div className="procreate-gallery-thumb">
                {art.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={art.thumbnail} alt="" />
                ) : (
                  <div className="procreate-gallery-thumb-empty" />
                )}
              </div>
              <div className="procreate-gallery-card-meta">
                <span className="procreate-gallery-card-name">{art.name}</span>
                <span className="procreate-gallery-card-size">
                  {art.width} × {art.height}
                </span>
              </div>
              <div className="procreate-gallery-card-actions">
                <button type="button" onClick={(e) => handleDuplicate(e, art.id)} title="Duplicate">
                  Duplicate
                </button>
                <button type="button" onClick={(e) => handleDelete(e, art.id)} title="Delete">
                  Delete
                </button>
              </div>
            </button>
          ))}
          <button type="button" className="procreate-gallery-card procreate-gallery-new" onClick={() => setShowNew(true)}>
            <IconPlus className="h-10 w-10" />
            <span>New canvas</span>
          </button>
        </div>
      )}

      {showNew ? (
        <div className="procreate-modal-backdrop" onClick={() => setShowNew(false)}>
          <div className="procreate-modal" onClick={(e) => e.stopPropagation()}>
            <h2>New canvas</h2>
            <label className="procreate-field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="procreate-field">
              <span>Canvas size</span>
              <select value={presetId} onChange={(e) => setPresetId(e.target.value)}>
                {CANVAS_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} — {p.width} × {p.height}px
                  </option>
                ))}
              </select>
            </label>
            <div className="procreate-modal-actions">
              <button type="button" className="procreate-btn-ghost" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button type="button" className="procreate-btn-primary" onClick={handleCreate}>
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
