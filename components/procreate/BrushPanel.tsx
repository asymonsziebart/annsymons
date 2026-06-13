"use client";

import { useMemo, useState } from "react";
import {
  BRUSHES,
  CATEGORY_LABELS,
  getBrushesByCategory,
} from "@/lib/procreate/brushes";
import type { BrushCategory, BrushDef } from "@/lib/procreate/types";
import { IconClose, IconSearch } from "./icons";
import { tipProps } from "./tip";

type Props = {
  selectedId: string;
  onSelect: (brush: BrushDef) => void;
  onClose: () => void;
};

export default function BrushPanel({ selectedId, onSelect, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<BrushCategory>("sketching");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return BRUSHES.filter((b) => b.name.toLowerCase().includes(q));
    return getBrushesByCategory(category);
  }, [search, category]);

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
          {(Object.keys(CATEGORY_LABELS) as BrushCategory[]).map((cat) => (
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
            {...tipProps(`Select ${brush.name} brush`)}
          >
            <span className="procreate-brush-preview" style={{ background: brush.preview }} />
            <span className="procreate-brush-name">{brush.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
