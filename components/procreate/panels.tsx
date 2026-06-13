"use client";

import { useState } from "react";
import type { BlendMode, ColorTab, Layer } from "@/lib/procreate/types";
import { BLEND_MODE_LABELS } from "@/lib/procreate/canvasEngine";
import { DEFAULT_PALETTES } from "@/lib/procreate/brushes";
import {
  hexToHsv,
  hexToRgb,
  hsvToHex,
  hsvToRgb,
  harmonyColors,
  rgbToHex,
  rgbToHsv,
} from "@/lib/procreate/colorUtils";
import { IconClose } from "./icons";

type ColorPanelProps = {
  color: string;
  previousColor: string;
  tab: ColorTab;
  onTabChange: (tab: ColorTab) => void;
  onColorChange: (hex: string) => void;
  onClose: () => void;
};

export function ColorPanel({
  color,
  previousColor,
  tab,
  onTabChange,
  onColorChange,
  onClose,
}: ColorPanelProps) {
  const hsv = hexToHsv(color);
  const rgb = hexToRgb(color);
  const harmonies = harmonyColors(color);

  return (
    <div className="procreate-panel procreate-color-panel">
      <div className="procreate-panel-header">
        <h3>Colors</h3>
        <button type="button" className="procreate-icon-btn" onClick={onClose} aria-label="Close">
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <div className="procreate-color-current">
        <button
          type="button"
          className="procreate-color-swatch large"
          style={{ background: color }}
          title="Current color"
        />
        <button
          type="button"
          className="procreate-color-swatch small"
          style={{ background: previousColor }}
          onClick={() => onColorChange(previousColor)}
          title="Previous color"
        />
      </div>

      {tab === "disc" && (
        <ColorDisc h={hsv.h} s={hsv.s} v={hsv.v} onChange={(h, s, v) => onColorChange(hsvToHex(h, s, v))} />
      )}

      {tab === "classic" && (
        <ClassicPicker
          h={hsv.h}
          s={hsv.s}
          v={hsv.v}
          onChange={(h, s, v) => onColorChange(hsvToHex(h, s, v))}
        />
      )}

      {tab === "value" && (
        <ValuePicker
          rgb={rgb}
          hex={color}
          onChange={(r, g, b) => onColorChange(rgbToHex(r, g, b))}
        />
      )}

      {tab === "palettes" && (
        <div className="procreate-palettes">
          {DEFAULT_PALETTES.map((palette) => (
            <div key={palette.name} className="procreate-palette-group">
              <p>{palette.name}</p>
              <div className="procreate-palette-row">
                {palette.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`procreate-color-swatch${c === color ? " active" : ""}`}
                    style={{ background: c }}
                    onClick={() => onColorChange(c)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab !== "palettes" && (
        <div className="procreate-palette-row compact">
          {DEFAULT_PALETTES[0].colors.map((c) => (
            <button
              key={c}
              type="button"
              className="procreate-color-swatch"
              style={{ background: c }}
              onClick={() => onColorChange(c)}
            />
          ))}
        </div>
      )}

      {tab === "disc" && (
        <div className="procreate-harmony">
          <p>Harmony</p>
          <div className="procreate-palette-row">
            {harmonies.map((c) => (
              <button
                key={c}
                type="button"
                className="procreate-color-swatch"
                style={{ background: c }}
                onClick={() => onColorChange(c)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="procreate-color-tabs">
        {(["disc", "classic", "value", "palettes"] as ColorTab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? "active" : ""}
            onClick={() => onTabChange(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorDisc({
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
  const innerBg = hsvToHex(h, 100, 100);

  return (
    <div className="procreate-color-disc-wrap">
      <div
        className="procreate-hue-ring"
        onPointerDown={(e) => pickHue(e, onChange, v, s)}
        onPointerMove={(e) => e.buttons === 1 && pickHue(e, onChange, v, s)}
      >
        <div
          className="procreate-sat-disc"
          style={{ background: innerBg }}
          onPointerDown={(e) => {
            e.stopPropagation();
            pickSat(e, h, v, onChange);
          }}
          onPointerMove={(e) => {
            if (e.buttons !== 1) return;
            e.stopPropagation();
            pickSat(e, h, v, onChange);
          }}
        >
          <span
            className="procreate-color-cursor"
            style={{ left: `${s}%`, top: `${100 - v}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function pickHue(
  e: React.PointerEvent,
  onChange: (h: number, s: number, v: number) => void,
  v: number,
  s: number,
) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  onChange(deg, s, v);
}

function pickSat(
  e: React.PointerEvent,
  h: number,
  v: number,
  onChange: (h: number, s: number, v: number) => void,
) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const s = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  const nv = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100));
  onChange(h, s, nv);
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
        onPointerDown={(e) => pickClassic(e, h, onChange)}
        onPointerMove={(e) => e.buttons === 1 && pickClassic(e, h, onChange)}
      >
        <span className="procreate-color-cursor" style={{ left: `${s}%`, top: `${100 - v}%` }} />
      </div>
      <input
        type="range"
        min={0}
        max={360}
        value={h}
        onChange={(e) => onChange(Number(e.target.value), s, v)}
        className="procreate-hue-slider"
      />
    </div>
  );
}

function pickClassic(
  e: React.PointerEvent,
  h: number,
  onChange: (h: number, s: number, v: number) => void,
) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const s = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  const v = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100));
  onChange(h, s, v);
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
      <label className="procreate-value-row">
        <span>H</span>
        <input type="number" value={Math.round(hsv.h)} readOnly />
        <span>S</span>
        <input type="number" value={Math.round(hsv.s)} readOnly />
        <span>B</span>
        <input type="number" value={Math.round(hsv.v)} readOnly />
      </label>
    </div>
  );
}

type LayersPanelProps = {
  layers: Layer[];
  activeId: string;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  onBlendChange: (id: string, mode: BlendMode) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onRename: (id: string, name: string) => void;
  onClose: () => void;
};

export function LayersPanel({
  layers,
  activeId,
  onSelect,
  onToggleVisible,
  onOpacityChange,
  onBlendChange,
  onAdd,
  onDelete,
  onDuplicate,
  onMove,
  onRename,
  onClose,
}: LayersPanelProps) {
  const [blendLayerId, setBlendLayerId] = useState<string | null>(null);

  return (
    <div className="procreate-panel procreate-layers-panel">
      <div className="procreate-panel-header">
        <h3>Layers</h3>
        <button type="button" className="procreate-icon-btn" onClick={onClose} aria-label="Close">
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <div className="procreate-layers-list">
        {[...layers].reverse().map((layer) => (
          <div
            key={layer.id}
            className={`procreate-layer-row${layer.id === activeId ? " active" : ""}`}
            onClick={() => onSelect(layer.id)}
          >
            <button
              type="button"
              className={`procreate-layer-vis${layer.visible ? "" : " hidden"}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisible(layer.id);
              }}
            >
              {layer.visible ? "●" : "○"}
            </button>
            <div className="procreate-layer-thumb">
              <LayerThumb canvas={layer.canvas} />
            </div>
            <input
              className="procreate-layer-name"
              value={layer.name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onRename(layer.id, e.target.value)}
            />
            <button
              type="button"
              className="procreate-layer-blend"
              onClick={(e) => {
                e.stopPropagation();
                setBlendLayerId(blendLayerId === layer.id ? null : layer.id);
              }}
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
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="procreate-layers-actions">
        <button type="button" onClick={onAdd}>+ Layer</button>
        <button type="button" onClick={() => onDuplicate(activeId)}>Duplicate</button>
        <button type="button" onClick={() => onMove(activeId, "up")}>↑</button>
        <button type="button" onClick={() => onMove(activeId, "down")}>↓</button>
        <button type="button" onClick={() => onDelete(activeId)}>Delete</button>
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
