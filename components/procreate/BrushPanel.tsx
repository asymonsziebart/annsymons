"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/procreate/brushes";
import { importProcreateBrushFile } from "@/lib/procreate/brushImport";
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
  const [category, setCategory] = useState<BrushCategory | "all">("all");
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

  const builtInCount = useMemo(
    () => allBrushes.filter((b) => b.category !== "imported").length,
    [allBrushes],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<BrushCategory | "all", number>();
    counts.set("all", builtInCount);
    for (const cat of Object.keys(CATEGORY_LABELS) as BrushCategory[]) {
      counts.set(cat, allBrushes.filter((b) => b.category === cat).length);
    }
    return counts;
  }, [allBrushes, builtInCount]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return allBrushes.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.setName?.toLowerCase().includes(q) ?? false),
      );
    }
    if (category === "all") {
      const order: BrushCategory[] = [
        "sketching",
        "inking",
        "painting",
        "artistic",
        "calligraphy",
        "textures",
        "elements",
      ];
      return allBrushes
        .filter((b) => b.category !== "imported")
        .sort(
          (a, b) =>
            order.indexOf(a.category) - order.indexOf(b.category) ||
            a.name.localeCompare(b.name),
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
      const set = await importProcreateBrushFile(file);
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
        <h3>
          Brushes
          {builtInCount > 0 && (
            <span className="procreate-brush-count"> ({builtInCount})</span>
          )}
        </h3>
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
          <button
            type="button"
            className={category === "all" ? "active" : ""}
            onClick={() => setCategory("all")}
            {...tipProps("Show all built-in brushes")}
          >
            All ({categoryCounts.get("all") ?? 0})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={category === cat ? "active" : ""}
              onClick={() => setCategory(cat)}
              {...tipProps(`Show ${CATEGORY_LABELS[cat]} brushes`)}
            >
              {CATEGORY_LABELS[cat]} ({categoryCounts.get(cat) ?? 0})
            </button>
          ))}
        </div>
      )}

      {!search && category !== "all" && (
        <p className="procreate-brush-filter-hint">
          Showing {filtered.length} {CATEGORY_LABELS[category as BrushCategory].toLowerCase()} brush
          {filtered.length === 1 ? "" : "es"}. Tap <strong>All</strong> to browse the full library.
        </p>
      )}

      <div className="procreate-brush-grid">
        {filtered.length === 0 ? (
          <p className="procreate-brush-empty">No brushes match your search.</p>
        ) : (
          filtered.map((brush) => (
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
          ))
        )}
      </div>
      {filtered.length > 0 && (
        <p className="procreate-brush-showing">
          Showing {filtered.length} brush{filtered.length === 1 ? "" : "es"}
          {search ? "" : category === "all" ? " — scroll for more" : ""}
        </p>
      )}
    </div>
  );
}
