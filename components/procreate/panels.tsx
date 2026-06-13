"use client";

import { useEffect, useRef, useState } from "react";
import type { BlendMode, ColorTab, CustomPalette, HarmonyMode, Layer } from "@/lib/procreate/types";
import { BLEND_MODE_LABELS } from "@/lib/procreate/canvasEngine";
import { DEFAULT_PALETTES } from "@/lib/procreate/brushes";
import {
  HARMONY_MODE_LABELS,
  harmonySchemeColors,
  hexToHsv,
  hexToRgb,
  hsvToHex,
  rgbToHex,
  rgbToHsv,
  snapDiscColor,
} from "@/lib/procreate/colorUtils";
import {
  loadColorHistory,
  loadCustomPalettes,
  pushColorHistory,
  saveCustomPalettes,
} from "@/lib/procreate/prefsStorage";
import { generateId } from "@/lib/procreate/storage";
import { IconClose, IconEye, IconEyeOff } from "./icons";
import { tipProps } from "./tip";

function ColorSwatch({
  hex,
  className = "procreate-color-swatch",
  active = false,
  onPick,
  tip,
}: {
  hex: string;
  className?: string;
  active?: boolean;
  onPick: () => void;
  tip: string;
}) {
  return (
    <button
      type="button"
      className={`${className}${active ? " active" : ""}`}
      style={{ background: hex }}
      {...tipProps(tip)}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        onPick();
      }}
    />
  );
}

type ColorPanelProps = {
  color: string;
  previousColor: string;
  tab: ColorTab;
  harmonyMode: HarmonyMode;
  onTabChange: (tab: ColorTab) => void;
  onHarmonyModeChange: (mode: HarmonyMode) => void;
  onColorChange: (hex: string) => void;
  onSwapColors: () => void;
  onClose: () => void;
};

const COLOR_TABS: ColorTab[] = ["disc", "classic", "harmony", "value", "palettes"];

const TAB_LABELS: Record<ColorTab, string> = {
  disc: "Disc",
  classic: "Classic",
  harmony: "Harmony",
  value: "Value",
  palettes: "Palettes",
};

export function ColorPanel({
  color,
  previousColor,
  tab,
  harmonyMode,
  onTabChange,
  onHarmonyModeChange,
  onColorChange,
  onSwapColors,
  onClose,
}: ColorPanelProps) {
  const hsv = hexToHsv(color);
  const rgb = hexToRgb(color);
  const [customPalettes, setCustomPalettes] = useState<CustomPalette[]>([]);
  const [paletteName, setPaletteName] = useState("My palette");
  const [history, setHistory] = useState<string[]>([]);
  const [discExpanded, setDiscExpanded] = useState(false);
  const [harmonyMenuOpen, setHarmonyMenuOpen] = useState(false);

  useEffect(() => {
    setCustomPalettes(loadCustomPalettes());
    setHistory(loadColorHistory());
  }, [color]);

  function pickColor(hex: string) {
    onColorChange(hex);
    pushColorHistory(hex);
    setHistory(loadColorHistory());
  }

  function saveCurrentPalette() {
    const name = paletteName.trim() || "My palette";
    const next: CustomPalette[] = [
      ...customPalettes,
      { id: generateId(), name, colors: [color, previousColor, ...DEFAULT_PALETTES[0].colors.slice(0, 6)] },
    ];
    setCustomPalettes(next);
    saveCustomPalettes(next);
  }

  const activePalette = DEFAULT_PALETTES[0].colors;

  return (
    <div className="procreate-panel procreate-color-panel">
      <div className="procreate-panel-header procreate-color-header">
        <h3>Colors</h3>
        <div className="procreate-color-primary-secondary">
          <ColorSwatch
            hex={color}
            className="procreate-color-swatch primary"
            onPick={onSwapColors}
            tip="Primary color — tap to swap with secondary"
          />
          <ColorSwatch
            hex={previousColor}
            className="procreate-color-swatch secondary"
            onPick={() => pickColor(previousColor)}
            tip="Secondary color — tap to use this color"
          />
        </div>
        <button
          type="button"
          className="procreate-icon-btn"
          onClick={onClose}
          {...tipProps("Close color panel")}
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      {tab === "disc" && (
        <ColorDisc
          h={hsv.h}
          s={hsv.s}
          v={hsv.v}
          expanded={discExpanded}
          onToggleExpand={() => setDiscExpanded((e) => !e)}
          onChange={(h, s, v) => pickColor(hsvToHex(h, s, v))}
        />
      )}

      {tab === "classic" && (
        <ClassicPicker
          h={hsv.h}
          s={hsv.s}
          v={hsv.v}
          onChange={(h, s, v) => pickColor(hsvToHex(h, s, v))}
        />
      )}

      {tab === "harmony" && (
        <HarmonyPicker
          h={hsv.h}
          s={hsv.s}
          v={hsv.v}
          mode={harmonyMode}
          menuOpen={harmonyMenuOpen}
          onMenuToggle={() => setHarmonyMenuOpen((o) => !o)}
          onModeChange={(mode) => {
            onHarmonyModeChange(mode);
            setHarmonyMenuOpen(false);
          }}
          onChange={(h, s, v) => pickColor(hsvToHex(h, s, v))}
          onPickColor={pickColor}
        />
      )}

      {tab === "value" && (
        <ValuePicker
          rgb={rgb}
          hex={color}
          onChange={(r, g, b) => pickColor(rgbToHex(r, g, b))}
        />
      )}

      {tab === "palettes" && (
        <div className="procreate-palettes">
          {DEFAULT_PALETTES.map((palette) => (
            <div key={palette.name} className="procreate-palette-group">
              <p>{palette.name}</p>
              <div className="procreate-palette-row">
                {palette.colors.map((c) => (
                  <ColorSwatch
                    key={c}
                    hex={c}
                    active={c.toLowerCase() === color.toLowerCase()}
                    onPick={() => pickColor(c)}
                    tip={`Select color ${c}`}
                  />
                ))}
              </div>
            </div>
          ))}
          {customPalettes.map((palette) => (
            <div key={palette.id} className="procreate-palette-group">
              <p>{palette.name}</p>
              <div className="procreate-palette-row">
                {palette.colors.map((c) => (
                  <ColorSwatch
                    key={`${palette.id}-${c}`}
                    hex={c}
                    active={c.toLowerCase() === color.toLowerCase()}
                    onPick={() => pickColor(c)}
                    tip={`Select color ${c}`}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="procreate-palette-save">
            <input
              type="text"
              value={paletteName}
              onChange={(e) => setPaletteName(e.target.value)}
              placeholder="Palette name"
            />
            <button type="button" className="procreate-btn-sm" onClick={saveCurrentPalette}>
              Save current colors
            </button>
          </div>
        </div>
      )}

      {tab !== "palettes" && (
        <>
          {history.length > 0 && (
            <div className="procreate-color-history">
              <p>History</p>
              <div className="procreate-palette-row compact">
                {history.map((c) => (
                  <ColorSwatch
                    key={c}
                    hex={c}
                    active={c.toLowerCase() === color.toLowerCase()}
                    onPick={() => pickColor(c)}
                    tip={`History color ${c}`}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="procreate-color-default-palette">
            <p>Default palette</p>
            <div className="procreate-palette-row compact">
              {activePalette.map((c) => (
                <ColorSwatch
                  key={c}
                  hex={c}
                  active={c.toLowerCase() === color.toLowerCase()}
                  onPick={() => pickColor(c)}
                  tip={`Select color ${c}`}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="procreate-color-tabs">
        {COLOR_TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "active" : ""}
            onClick={() => onTabChange(t)}
            {...tipProps(`${TAB_LABELS[t]} color picker`)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

function bindPointerDrag(
  e: React.PointerEvent,
  move: (ev: PointerEvent) => void,
  end?: () => void,
) {
  e.preventDefault();
  e.stopPropagation();

  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return;
    ev.preventDefault();
    move(ev);
  };
  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return;
    if (target.hasPointerCapture(ev.pointerId)) {
      target.releasePointerCapture(ev.pointerId);
    }
    target.removeEventListener("pointermove", onMove);
    target.removeEventListener("pointerup", onUp);
    target.removeEventListener("pointercancel", onUp);
    end?.();
  };
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerup", onUp);
  target.addEventListener("pointercancel", onUp);
}

function bindPickerDrag(
  e: React.PointerEvent,
  pick: (ev: PointerEvent, el: HTMLElement) => void,
  el: HTMLElement,
  end?: () => void,
) {
  pick(e.nativeEvent, el);
  bindPointerDrag(e, (ev) => pick(ev, el), end);
}

function ColorDisc({
  h,
  s,
  v,
  expanded,
  onToggleExpand,
  onChange,
}: {
  h: number;
  s: number;
  v: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (h: number, s: number, v: number) => void;
}) {
  const hueColor = hsvToHex(h, 100, 100);
  const hueAngle = ((h - 90) * Math.PI) / 180;
  const ringR = expanded ? 118 : 98;
  const hueX = 50 + (Math.cos(hueAngle) * ringR) / (expanded ? 260 : 200) * 100;
  const hueY = 50 + (Math.sin(hueAngle) * ringR) / (expanded ? 260 : 200) * 100;

  return (
    <div className={`procreate-color-disc-wrap${expanded ? " expanded" : ""}`}>
      <div
        className="procreate-hue-ring"
        onPointerDown={(e) => {
          bindPickerDrag(
            e,
            (ev, el) => pickHuePointer(ev, onChange, v, s, el),
            e.currentTarget as HTMLElement,
          );
        }}
      >
        <span
          className="procreate-hue-cursor"
          style={{ left: `${hueX}%`, top: `${hueY}%` }}
          onPointerDown={(e) => {
            bindPickerDrag(
              e,
              (ev, el) => pickHuePointer(ev, onChange, v, s, el),
              e.currentTarget.parentElement as HTMLElement,
            );
          }}
        />
        <div
          className="procreate-sat-disc"
          style={{
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            bindPickerDrag(e, (ev, el) => pickSatPointer(ev, h, onChange, el), e.currentTarget as HTMLElement);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            const snapped = snapDiscColor(h, s, v);
            onChange(snapped.h, snapped.s, snapped.v);
          }}
        >
          <span
            className="procreate-color-cursor"
            style={{ left: `${s}%`, top: `${100 - v}%` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              bindPickerDrag(
                e,
                (ev, el) => pickSatPointer(ev, h, onChange, el),
                e.currentTarget.parentElement as HTMLElement,
              );
            }}
          />
        </div>
      </div>
      <button type="button" className="procreate-disc-expand-btn" onClick={onToggleExpand}>
        {expanded ? "Shrink disc" : "Expand disc for fine control"}
      </button>
    </div>
  );
}

function HarmonyPicker({
  h,
  s,
  v,
  mode,
  menuOpen,
  onMenuToggle,
  onModeChange,
  onChange,
  onPickColor,
}: {
  h: number;
  s: number;
  v: number;
  mode: HarmonyMode;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onModeChange: (mode: HarmonyMode) => void;
  onChange: (h: number, s: number, v: number) => void;
  onPickColor: (hex: string) => void;
}) {
  const scheme = harmonySchemeColors(h, s, v, mode);

  return (
    <div className="procreate-harmony-picker">
      <div className="procreate-harmony-mode">
        <button type="button" className="procreate-harmony-mode-btn" onClick={onMenuToggle}>
          {HARMONY_MODE_LABELS[mode]}
        </button>
        {menuOpen && (
          <div className="procreate-harmony-mode-menu">
            {(Object.keys(HARMONY_MODE_LABELS) as HarmonyMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={m === mode ? "active" : ""}
                onClick={() => onModeChange(m)}
              >
                {HARMONY_MODE_LABELS[m]}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        className="procreate-harmony-wheel"
        onPointerDown={(e) => {
          bindPickerDrag(
            e,
            (ev, el) => pickHarmonyWheelPointer(ev, v, onChange, el),
            e.currentTarget as HTMLElement,
          );
        }}
      >
        {scheme.map((hex, i) => {
          const { h: hh, s: ss } = hexToHsv(hex);
          const angle = ((hh - 90) * Math.PI) / 180;
          const radius = Math.max(8, ss);
          const x = 50 + (Math.cos(angle) * radius * 0.46);
          const y = 50 + (Math.sin(angle) * radius * 0.46);
          return (
            <button
              key={`${mode}-${i}-${hex}`}
              type="button"
              className={`procreate-harmony-reticle${i === 0 ? " primary" : ""}`}
              style={{ left: `${x}%`, top: `${y}%`, background: hex }}
              {...tipProps(i === 0 ? "Primary harmony color" : "Harmony color — tap to paint with this")}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
                onPickColor(hex);
                if (i > 0) {
                  const picked = hexToHsv(hex);
                  onChange(picked.h, picked.s, v);
                }
              }}
            />
          );
        })}
      </div>
      <label className="procreate-harmony-brightness">
        <span>Brightness</span>
        <input
          type="range"
          min={0}
          max={100}
          value={v}
          onChange={(e) => onChange(h, s, Number(e.target.value))}
        />
      </label>
    </div>
  );
}

function pickHarmonyWheelPointer(
  e: PointerEvent,
  v: number,
  onChange: (h: number, s: number, v: number) => void,
  el: HTMLElement,
) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;
  const dist = Math.min(rect.width / 2, Math.hypot(dx, dy));
  const maxR = rect.width / 2;
  const s = Math.max(0, Math.min(100, (dist / maxR) * 100));
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  onChange(deg, s, v);
}

function pickHuePointer(
  e: PointerEvent,
  onChange: (h: number, s: number, v: number) => void,
  v: number,
  s: number,
  el: HTMLElement,
) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  onChange(deg, s, v);
}

function pickSatPointer(
  e: PointerEvent,
  h: number,
  onChange: (h: number, s: number, v: number) => void,
  el: HTMLElement,
) {
  const rect = el.getBoundingClientRect();
  const ns = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  const nv = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100));
  onChange(h, ns, nv);
}

function ClassicPicker({
  h,
  s,
  v,
  onChange,
}: {
  h: number;
  s: number;
  v: number;
  onChange: (h: number, s: number, v: number) => void;
}) {
  const hueColor = hsvToHex(h, 100, 100);
  return (
    <div className="procreate-classic-picker">
      <div
        className="procreate-classic-square"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
        }}
        onPointerDown={(e) => {
          bindPickerDrag(
            e,
            (ev, el) => pickClassicPointer(ev, h, onChange, el),
            e.currentTarget as HTMLElement,
          );
        }}
      >
        <span
          className="procreate-color-cursor"
          style={{ left: `${s}%`, top: `${100 - v}%` }}
          onPointerDown={(e) => {
            bindPickerDrag(
              e,
              (ev, el) => pickClassicPointer(ev, h, onChange, el),
              e.currentTarget.parentElement as HTMLElement,
            );
          }}
        />
      </div>
      {(["Hue", "Saturation", "Brightness"] as const).map((label, idx) => {
        const key = ["h", "s", "v"][idx] as "h" | "s" | "v";
        const max = key === "h" ? 360 : 100;
        const val = key === "h" ? h : key === "s" ? s : v;
        return (
          <label key={label} className="procreate-classic-slider">
            <span>{label}</span>
            <input
              type="range"
              min={0}
              max={max}
              value={val}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (key === "h") onChange(n, s, v);
                else if (key === "s") onChange(h, n, v);
                else onChange(h, s, n);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}

function pickClassicPointer(
  e: PointerEvent,
  h: number,
  onChange: (h: number, s: number, v: number) => void,
  el: HTMLElement,
) {
  const rect = el.getBoundingClientRect();
  const ns = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  const nv = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100));
  onChange(h, ns, nv);
}

function ValuePicker({
  rgb,
  hex,
  onChange,
}: {
  rgb: { r: number; g: number; b: number };
  hex: string;
  onChange: (r: number, g: number, b: number) => void;
}) {
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  return (
    <div className="procreate-value-picker">
      {(
        [
          ["Hue", "h", 360, hsv.h],
          ["Saturation", "s", 100, hsv.s],
          ["Brightness", "b", 100, hsv.v],
        ] as const
      ).map(([label, ch, max, val]) => (
        <label key={ch} className="procreate-value-row">
          <span>{label}</span>
          <input
            type="range"
            min={0}
            max={max}
            value={val}
            onChange={(e) => {
              const n = Number(e.target.value);
              const next =
                ch === "h"
                  ? hsvToHex(n, hsv.s, hsv.v)
                  : ch === "s"
                    ? hsvToHex(hsv.h, n, hsv.v)
                    : hsvToHex(hsv.h, hsv.s, n);
              const { r, g, b } = hexToRgb(next);
              onChange(r, g, b);
            }}
          />
          <input type="number" min={0} max={max} value={Math.round(val)} readOnly />
        </label>
      ))}
      {(["r", "g", "b"] as const).map((ch) => (
        <label key={ch} className="procreate-value-row">
          <span>{ch.toUpperCase()}</span>
          <input
            type="range"
            min={0}
            max={255}
            value={rgb[ch]}
            onChange={(e) => {
              const next = { ...rgb, [ch]: Number(e.target.value) };
              onChange(next.r, next.g, next.b);
            }}
          />
          <input
            type="number"
            min={0}
            max={255}
            value={rgb[ch]}
            onChange={(e) => {
              const next = { ...rgb, [ch]: Number(e.target.value) };
              onChange(next.r, next.g, next.b);
            }}
          />
        </label>
      ))}
      <label className="procreate-value-row">
        <span>HEX</span>
        <input
          className="procreate-hex-input"
          value={hex}
          onChange={(e) => {
            const val = e.target.value;
            if (/^#[0-9a-fA-F]{6}$/.test(val)) {
              const { r, g, b } = hexToRgb(val);
              onChange(r, g, b);
            }
          }}
        />
      </label>
    </div>
  );
}

type LayersPanelProps = {
  layers: Layer[];
  activeId: string;
  optionsLayerId: string | null;
  editingMaskLayerId: string | null;
  onSelect: (id: string) => void;
  onOptionsLayer: (id: string | null) => void;
  onLayerAction: (action: LayerMenuAction, id: string) => void;
  onToggleVisible: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  onBlendChange: (id: string, mode: BlendMode) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onReorder: (fromId: string, toId: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleLock: (id: string) => void;
  onToggleAlphaLock: (id: string) => void;
  onToggleClip: (id: string) => void;
  onMergeDown: (id: string) => void;
  onGroup: (id: string) => void;
  onClose: () => void;
};

export type LayerMenuAction =
  | "select"
  | "copy"
  | "fill"
  | "clear"
  | "alphaLock"
  | "mask"
  | "editMask"
  | "deleteMask"
  | "clip"
  | "lock"
  | "invert"
  | "reference"
  | "mergeDown"
  | "duplicate"
  | "delete";

function LayerOptionsMenu({
  layer,
  layerIndex,
  layerCount,
  editingMask,
  onAction,
  onClose,
}: {
  layer: Layer;
  layerIndex: number;
  layerCount: number;
  editingMask: boolean;
  onAction: (action: LayerMenuAction) => void;
  onClose: () => void;
}) {
  const canClip = layerIndex > 0;
  const hasMask = !!layer.maskCanvas;

  return (
    <div className="procreate-layer-options" onClick={(e) => e.stopPropagation()}>
      <div className="procreate-layer-options-header">
        <strong>{layer.name}</strong>
        <button type="button" className="procreate-icon-btn" onClick={onClose} aria-label="Close">
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      <div className="procreate-layer-options-list">
        <button type="button" onClick={() => onAction("select")}>
          Select
        </button>
        <button type="button" onClick={() => onAction("copy")}>
          Copy
        </button>
        <button type="button" onClick={() => onAction("fill")}>
          Fill Layer
        </button>
        <button type="button" onClick={() => onAction("clear")}>
          Clear
        </button>
        <hr />
        <button type="button" className={layer.alphaLock ? "active" : ""} onClick={() => onAction("alphaLock")}>
          Alpha Lock{layer.alphaLock ? " ✓" : ""}
        </button>
        {!hasMask ? (
          <button type="button" onClick={() => onAction("mask")}>
            Mask
          </button>
        ) : (
          <>
            <button type="button" className={editingMask ? "active" : ""} onClick={() => onAction("editMask")}>
              {editingMask ? "Edit Mask (active)" : "Edit Mask"}
            </button>
            <button type="button" onClick={() => onAction("deleteMask")}>
              Delete Mask
            </button>
          </>
        )}
        <button
          type="button"
          className={layer.clipToLayerId ? "active" : ""}
          disabled={!canClip}
          onClick={() => onAction("clip")}
        >
          Clipping Mask{layer.clipToLayerId ? " ✓" : ""}
        </button>
        <button type="button" className={layer.locked ? "active" : ""} onClick={() => onAction("lock")}>
          Lock{layer.locked ? " ✓" : ""}
        </button>
        <hr />
        <button type="button" onClick={() => onAction("invert")}>
          Invert
        </button>
        <button type="button" className={layer.referenceLayer ? "active" : ""} onClick={() => onAction("reference")}>
          Reference{layer.referenceLayer ? " ✓" : ""}
        </button>
        <hr />
        <button type="button" disabled={layerIndex === 0} onClick={() => onAction("mergeDown")}>
          Merge Down
        </button>
        <button type="button" onClick={() => onAction("duplicate")}>
          Duplicate
        </button>
        <button type="button" className="danger" onClick={() => onAction("delete")}>
          Delete
        </button>
      </div>
    </div>
  );
}

export function LayersPanel({
  layers,
  activeId,
  optionsLayerId,
  editingMaskLayerId,
  onSelect,
  onOptionsLayer,
  onLayerAction,
  onToggleVisible,
  onOpacityChange,
  onBlendChange,
  onAdd,
  onDelete,
  onDuplicate,
  onMove,
  onReorder,
  onRename,
  onToggleLock,
  onToggleAlphaLock,
  onToggleClip,
  onMergeDown,
  onGroup,
  onClose,
}: LayersPanelProps) {
  const [blendLayerId, setBlendLayerId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className="procreate-panel procreate-layers-panel">
      <div className="procreate-panel-header">
        <h3>Layers</h3>
        <button
          type="button"
          className="procreate-icon-btn"
          onClick={onClose}
          {...tipProps("Close layers panel")}
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <div className="procreate-layers-list">
        {[...layers].reverse().map((layer, revIdx) => {
          const layerIndex = layers.length - 1 - revIdx;
          return (
          <div
            key={layer.id}
            className={`procreate-layer-row${layer.id === activeId ? " active" : ""}${layer.groupId ? " grouped" : ""}${optionsLayerId === layer.id ? " options-open" : ""}${editingMaskLayerId === layer.id ? " editing-mask" : ""}`}
            draggable
            onDragStart={() => setDragId(layer.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId && dragId !== layer.id) onReorder(dragId, layer.id);
              setDragId(null);
            }}
            onClick={() => {
              if (layer.id === activeId) {
                onOptionsLayer(optionsLayerId === layer.id ? null : layer.id);
              } else {
                onSelect(layer.id);
                onOptionsLayer(null);
              }
            }}
          >
            <button
              type="button"
              className={`procreate-layer-vis${layer.visible ? "" : " is-off"}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisible(layer.id);
              }}
              {...tipProps(layer.visible ? "Hide this layer" : "Show this layer")}
            >
              {layer.visible ? (
                <IconEye className="h-4 w-4" />
              ) : (
                <IconEyeOff className="h-4 w-4" />
              )}
            </button>
            <div
              className={`procreate-layer-thumb${layer.alphaLock ? " alpha-lock" : ""}${layer.clipToLayerId ? " clipped" : ""}`}
            >
              <LayerThumb canvas={layer.canvas} />
              {layer.maskCanvas && <span className="procreate-layer-badge mask">M</span>}
              {layer.referenceLayer && <span className="procreate-layer-badge ref">Ref</span>}
            </div>
            <input
              className="procreate-layer-name"
              value={layer.name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onRename(layer.id, e.target.value)}
            />
            <div className="procreate-layer-flags" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={layer.locked ? "on" : ""}
                onClick={() => onToggleLock(layer.id)}
                title="Lock"
              >
                L
              </button>
              <button
                type="button"
                className={layer.alphaLock ? "on" : ""}
                onClick={() => onToggleAlphaLock(layer.id)}
                title="Alpha lock"
              >
                A
              </button>
              <button
                type="button"
                className={layer.clipToLayerId ? "on" : ""}
                onClick={() => onToggleClip(layer.id)}
                title="Clipping mask"
              >
                C
              </button>
            </div>
            <button
              type="button"
              className="procreate-layer-blend"
              onClick={(e) => {
                e.stopPropagation();
                setBlendLayerId(blendLayerId === layer.id ? null : layer.id);
              }}
              {...tipProps("Change blend mode and layer opacity")}
            >
              {layer.blendMode === "normal" ? "N" : layer.blendMode.slice(0, 2).toUpperCase()}
            </button>
            {blendLayerId === layer.id && (
              <div className="procreate-blend-menu" onClick={(e) => e.stopPropagation()}>
                <label>
                  Opacity
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={layer.opacity}
                    onChange={(e) => onOpacityChange(layer.id, Number(e.target.value))}
                  />
                </label>
                <div className="procreate-blend-list">
                  {BLEND_MODE_LABELS.map(({ mode, label }) => (
                    <button
                      key={mode}
                      type="button"
                      className={layer.blendMode === mode ? "active" : ""}
                      onClick={() => onBlendChange(layer.id, mode)}
                      {...tipProps(`Apply ${label} blend mode`)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {optionsLayerId === layer.id && (
              <LayerOptionsMenu
                layer={layer}
                layerIndex={layerIndex}
                layerCount={layers.length}
                editingMask={editingMaskLayerId === layer.id}
                onAction={(action) => onLayerAction(action, layer.id)}
                onClose={() => onOptionsLayer(null)}
              />
            )}
          </div>
          );
        })}
      </div>

      <div className="procreate-layers-actions">
        <button type="button" onClick={onAdd} {...tipProps("Add a new blank layer")}>
          + Layer
        </button>
        <button type="button" onClick={() => onDuplicate(activeId)} {...tipProps("Duplicate the active layer")}>
          Duplicate
        </button>
        <button type="button" onClick={() => onMergeDown(activeId)} {...tipProps("Merge active layer down")}>
          Merge ↓
        </button>
        <button type="button" onClick={() => onGroup(activeId)} {...tipProps("Group with layer below")}>
          Group
        </button>
        <button type="button" onClick={() => onMove(activeId, "up")} {...tipProps("Move layer up (in front)")}>
          ↑
        </button>
        <button type="button" onClick={() => onMove(activeId, "down")} {...tipProps("Move layer down (behind)")}>
          ↓
        </button>
        <button type="button" onClick={() => onDelete(activeId)} {...tipProps("Delete the active layer")}>
          Delete
        </button>
      </div>
    </div>
  );
}

function LayerThumb({ canvas }: { canvas: HTMLCanvasElement }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={canvas.toDataURL()} alt="" width={40} height={40} />
  );
}
