"use client";

import { useState } from "react";
import type {
  AdjustmentType,
  AnimationFrame,
  BrushDef,
  BrushOverrides,
  SelectionMode,
  SymmetryMode,
  TextObject,
} from "@/lib/procreate/types";
import { ADJUSTMENT_LABELS } from "@/lib/procreate/adjustments";
import { IconClose } from "./icons";
import { tipProps } from "./tip";

export function SelectionPanel({
  mode,
  onModeChange,
  hasSelection,
  onClear,
  onInvert,
  onDelete,
  onClose,
}: {
  mode: SelectionMode;
  onModeChange: (m: SelectionMode) => void;
  hasSelection: boolean;
  onClear: () => void;
  onInvert: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="procreate-panel procreate-selection-panel">
      <div className="procreate-panel-header">
        <h3>Selection</h3>
        <button type="button" className="procreate-icon-btn" onClick={onClose} {...tipProps("Close")}>
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      <div className="procreate-mode-grid">
        {(
          [
            ["freehand", "Freehand"],
            ["rect", "Rectangle"],
            ["auto", "Automatic"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            className={mode === m ? "active" : ""}
            onClick={() => onModeChange(m)}
            {...tipProps(`${label} selection`)}
          >
            {label}
          </button>
        ))}
      </div>
      {hasSelection && (
        <div className="procreate-actions-list">
          <button type="button" onClick={onClear} {...tipProps("Deselect")}>
            Deselect
          </button>
          <button type="button" onClick={onInvert} {...tipProps("Invert selection")}>
            Invert
          </button>
          <button type="button" onClick={onDelete} {...tipProps("Clear selected pixels")}>
            Clear selection
          </button>
        </div>
      )}
      <p className="procreate-panel-hint">Drag on canvas to select. Automatic selects similar colors.</p>
    </div>
  );
}

export function AdjustmentsPanel({
  onApply,
  onClose,
}: {
  onApply: (type: AdjustmentType, amount: number) => void;
  onClose: () => void;
}) {
  const [amounts, setAmounts] = useState<Record<AdjustmentType, number>>(() =>
    Object.fromEntries(ADJUSTMENT_LABELS.map((a) => [a.type, a.default])) as Record<AdjustmentType, number>,
  );

  return (
    <div className="procreate-panel procreate-adjust-panel">
      <div className="procreate-panel-header">
        <h3>Adjustments</h3>
        <button type="button" className="procreate-icon-btn" onClick={onClose} {...tipProps("Close")}>
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      {ADJUSTMENT_LABELS.map((adj) => (
        <label key={adj.type} className="procreate-actions-slider">
          {adj.label}
          <input
            type="range"
            min={adj.min}
            max={adj.max}
            step={0.01}
            value={amounts[adj.type]}
            onChange={(e) => setAmounts({ ...amounts, [adj.type]: Number(e.target.value) })}
          />
          <button type="button" className="procreate-btn-sm" onClick={() => onApply(adj.type, amounts[adj.type])}>
            Apply
          </button>
        </label>
      ))}
      <p className="procreate-panel-hint">Applies to active layer, or selection if one exists.</p>
    </div>
  );
}

export function BrushStudioPanel({
  brush,
  overrides,
  onChange,
  onClose,
}: {
  brush: BrushDef;
  overrides: BrushOverrides;
  onChange: (o: BrushOverrides) => void;
  onClose: () => void;
}) {
  const fields: { key: keyof BrushOverrides; label: string; min: number; max: number }[] = [
    { key: "size", label: "Size", min: 1, max: 120 },
    { key: "opacity", label: "Opacity", min: 0.05, max: 1 },
    { key: "spacing", label: "Spacing", min: 0.02, max: 0.5 },
    { key: "flow", label: "Flow", min: 0.1, max: 1 },
    { key: "hardness", label: "Hardness", min: 0, max: 1 },
    { key: "scatter", label: "Scatter", min: 0, max: 1 },
    { key: "streamline", label: "Streamline", min: 0, max: 0.95 },
    { key: "wetMix", label: "Wet mix", min: 0, max: 1 },
    { key: "taper", label: "Taper", min: 0, max: 0.5 },
  ];

  return (
    <div className="procreate-panel procreate-brush-studio">
      <div className="procreate-panel-header">
        <h3>Brush Studio — {brush.name}</h3>
        <button type="button" className="procreate-icon-btn" onClick={onClose} {...tipProps("Close")}>
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      {fields.map(({ key, label, min, max }) => {
        const val = overrides[key] ?? brush[key];
        return (
          <label key={key} className="procreate-actions-slider">
            {label}
            <input
              type="range"
              min={min}
              max={max}
              step={0.01}
              value={val as number}
              onChange={(e) => onChange({ ...overrides, [key]: Number(e.target.value) })}
            />
          </label>
        );
      })}
      <button type="button" className="procreate-btn-sm" onClick={() => onChange({})}>
        Reset to brush defaults
      </button>
    </div>
  );
}

export function AnimationPanel({
  frames,
  currentIndex,
  onionSkin,
  onToggleOnion,
  onAddFrame,
  onSelectFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onClose,
}: {
  frames: AnimationFrame[];
  currentIndex: number;
  onionSkin: boolean;
  onToggleOnion: () => void;
  onAddFrame: () => void;
  onSelectFrame: (i: number) => void;
  onDuplicateFrame: (i: number) => void;
  onDeleteFrame: (i: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="procreate-panel procreate-animation-panel">
      <div className="procreate-panel-header">
        <h3>Animation Assist</h3>
        <button type="button" className="procreate-icon-btn" onClick={onClose} {...tipProps("Close")}>
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      <label className="procreate-toggle">
        <input type="checkbox" checked={onionSkin} onChange={onToggleOnion} />
        Onion skin (previous frame)
      </label>
      <div className="procreate-frame-list">
        {frames.map((f, i) => (
          <button
            key={f.id}
            type="button"
            className={`procreate-frame-item${i === currentIndex ? " active" : ""}`}
            onClick={() => onSelectFrame(i)}
          >
            {i + 1}. {f.label}
          </button>
        ))}
      </div>
      <div className="procreate-layers-actions">
        <button type="button" onClick={onAddFrame}>
          + Frame
        </button>
        <button type="button" onClick={() => onDuplicateFrame(currentIndex)}>
          Duplicate
        </button>
        <button type="button" onClick={() => onDeleteFrame(currentIndex)} disabled={frames.length <= 1}>
          Delete
        </button>
      </div>
    </div>
  );
}

export function TextPanel({
  textObj,
  onChange,
  onApply,
  onClose,
}: {
  textObj: TextObject;
  onChange: (t: TextObject) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <div className="procreate-panel procreate-text-panel">
      <div className="procreate-panel-header">
        <h3>Text</h3>
        <button type="button" className="procreate-icon-btn" onClick={onClose} {...tipProps("Close")}>
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      <textarea
        className="procreate-text-input"
        value={textObj.text}
        onChange={(e) => onChange({ ...textObj, text: e.target.value })}
        rows={3}
        placeholder="Type here…"
      />
      <label className="procreate-actions-slider">
        Size
        <input
          type="range"
          min={8}
          max={200}
          value={textObj.fontSize}
          onChange={(e) => onChange({ ...textObj, fontSize: Number(e.target.value) })}
        />
      </label>
      <label className="procreate-value-row">
        <span>Color</span>
        <input
          type="color"
          value={textObj.color}
          onChange={(e) => onChange({ ...textObj, color: e.target.value })}
        />
      </label>
      <button type="button" className="procreate-btn-primary" onClick={onApply}>
        Place on canvas
      </button>
    </div>
  );
}

export function QuickMenu({
  open,
  onClose,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  if (!open) return null;
  const items = [
    ["undo", "Undo"],
    ["redo", "Redo"],
    ["flip-h", "Flip canvas ↔"],
    ["flip-v", "Flip canvas ↕"],
    ["merge", "Merge down"],
    ["sym-v", "Symmetry vertical"],
    ["sym-h", "Symmetry horizontal"],
    ["sym-q", "Symmetry quad"],
    ["sym-off", "Symmetry off"],
    ["fit", "Fit to screen"],
  ];
  return (
    <div className="procreate-quickmenu-backdrop" onClick={onClose}>
      <div className="procreate-quickmenu" onClick={(e) => e.stopPropagation()}>
        {items.map(([id, label]) => (
          <button key={id} type="button" onClick={() => { onAction(id); onClose(); }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SymmetryBar({
  mode,
  onChange,
}: {
  mode: SymmetryMode;
  onChange: (m: SymmetryMode) => void;
}) {
  return (
    <div className="procreate-symmetry-bar">
      {(
        [
          ["none", "Off"],
          ["vertical", "↕"],
          ["horizontal", "↔"],
          ["quad", "✛"],
        ] as const
      ).map(([m, label]) => (
        <button
          key={m}
          type="button"
          className={mode === m ? "active" : ""}
          onClick={() => onChange(m)}
          {...tipProps(`Symmetry ${label}`)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
