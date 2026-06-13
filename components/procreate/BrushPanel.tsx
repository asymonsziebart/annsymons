"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/procreate/brushes";
import type { ImportedBrushSet } from "@/lib/procreate/brushImport";
import {
  getAllBrushes,
  getBrushesByCategoryFromList,
  preloadBrushSet,
} from "@/lib/procreate/brushLibrary";
import {
  deleteImportedBrushSet,
  listImportedBrushSets,
  saveImportedBrushSet,
} from "@/lib/procreate/storage";
import type { BrushCategory, BrushDef } from "@/lib/procreate/types";
import { IconClose, IconSearch } from "./icons";
import { tipProps } from "./tip";

type Props = {
  selectedId: string;
  onSelect: (brush: BrushDef) => void;
  onClose: () => void;
  onBrushesChange?: (brushes: BrushDef[]) => void;
};

export default function BrushPanel({
  selectedId,
  onSelect,
  onClose,
  onBrushesChange,
}: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<BrushCategory>("sketching");
  const [allBrushes, setAllBrushes] = useState<BrushDef[]>([]);
  const [importedSets, setImportedSets] = useState<ImportedBrushSet[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [brushes, sets] = await Promise.all([getAllBrushes(), listImportedBrushSets()]);
    setAllBrushes(brushes);
    setImportedSets(sets);
    onBrushesChange?.(brushes);
  }, [onBrushesChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categories = useMemo(() => {
    const keys = Object.keys(CATEGORY_LABELS) as BrushCategory[];
    const hasImported = allBrushes.some((b) => b.category === "imported");
    return hasImported ? keys : keys.filter((k) => k !== "imported");
  }, [allBrushes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return allBrushes.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.setName?.toLowerCase().includes(q) ?? false),
      );
    }
    return getBrushesByCategoryFromList(allBrushes, category);
  }, [search, category, allBrushes]);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/procreate/import-brush", { method: "POST", body });
      const data = (await res.json()) as ImportedBrushSet & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed");

      const set = data;
      await saveImportedBrushSet(set);
      await preloadBrushSet(set);
      await refresh();
      setCategory("imported");
      if (set.brushes[0]) onSelect(set.brushes[0]);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleDeleteSet(id: string) {
    if (!confirm("Remove this imported brush set?")) return;
    await deleteImportedBrushSet(id);
    await refresh();
  }

  return (
    <div className="procreate-panel procreate-brush-panel">
      <div className="procreate-panel-header">
        <h3>Brushes</h3>
        <button
          type="button"
          className="procreate-icon-btn"
          onClick={onClose}
          {...tipProps("Close brush library")}
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <div className="procreate-brush-import-row">
        <label className="procreate-btn-primary procreate-import-btn">
          {importing ? "Importing…" : "Import .brushset"}
          <input
            ref={fileRef}
            type="file"
            accept=".brushset,.brush,application/octet-stream"
            hidden
            onChange={(e) => void handleImportFile(e)}
          />
        </label>
        <span className="procreate-import-hint">From Downloads or Files</span>
      </div>
      {importError ? <p className="procreate-import-error">{importError}</p> : null}

      {importedSets.length > 0 && category === "imported" && !search && (
        <div className="procreate-imported-sets">
          {importedSets.map((set) => (
            <div key={set.id} className="procreate-imported-set-row">
              <span>
                {set.name} ({set.brushes.length})
              </span>
              <button type="button" onClick={() => void handleDeleteSet(set.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="procreate-brush-search">
        <IconSearch className="h-4 w-4" />
        <input
          placeholder="Search brushes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!search && (
        <div className="procreate-brush-categories">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={category === cat ? "active" : ""}
              onClick={() => setCategory(cat)}
              {...tipProps(`Show ${CATEGORY_LABELS[cat]} brushes`)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      )}

      <div className="procreate-brush-grid">
        {filtered.map((brush) => (
          <button
            key={brush.id}
            type="button"
            className={`procreate-brush-item${selectedId === brush.id ? " selected" : ""}`}
            onClick={() => onSelect(brush)}
            {...tipProps(
              brush.setName
                ? `${brush.name} — from ${brush.setName}`
                : `Select ${brush.name} brush`,
            )}
          >
            {brush.tipImage || brush.preview.startsWith("data:") ? (
              <span
                className="procreate-brush-preview has-image"
                style={{
                  backgroundImage: `url(${brush.tipImage ?? brush.preview})`,
                }}
              />
            ) : (
              <span className="procreate-brush-preview" style={{ background: brush.preview }} />
            )}
            <span className="procreate-brush-name">{brush.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
