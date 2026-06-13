/**
 * Extended studio helpers — keeps Studio.tsx maintainable.
 */
import type {
  AdjustmentType,
  AnimationFrame,
  BrushDef,
  BrushOverrides,
  Layer,
  Point,
  SelectionMask,
  SelectionMode,
  StudioMode,
  TextObject,
  TransformState,
} from "@/lib/procreate/types";
import { applyAdjustment } from "./adjustments";
import { applyMaskToLayer, createEmptyMask, maskFromAutoSelect, maskFromPolygon, maskFromRect } from "./selection";
import {
  beginTransform,
  commitTransform,
  drawTransformHandles,
  hitTransformHandle,
  previewTransform,
  type HandleId,
} from "./transform";
import {
  detectQuickShape,
  drawQuickShape,
  makePerfectQuickShape,
  QUICK_SHAPE_HOLD_MS,
  QUICK_SHAPE_STILL_PX,
  sampleQuickShapePoints,
  type QuickShapeResult,
} from "./quickShape";
import { renderTextToLayer } from "./textTool";
import { captureLayerState, cloneImageData } from "./canvasEngine";

export function effectiveBrush(brush: BrushDef, overrides: BrushOverrides): BrushDef {
  return { ...brush, ...overrides };
}

export function mergeLayerDown(layers: Layer[], id: string): Layer[] {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx <= 0) return layers;
  const below = layers[idx - 1];
  const current = layers[idx];
  const ctx = below.canvas.getContext("2d");
  if (ctx) {
    ctx.save();
    ctx.globalAlpha = current.opacity;
    ctx.drawImage(current.canvas, 0, 0);
    ctx.restore();
  }
  return layers.filter((l) => l.id !== id);
}

export function reorderLayers(layers: Layer[], fromId: string, toId: string): Layer[] {
  const fromIdx = layers.findIndex((l) => l.id === fromId);
  const toIdx = layers.findIndex((l) => l.id === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return layers;
  const next = [...layers];
  const [item] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, item);
  return next;
}

export function flipCanvasLayers(layers: Layer[], horizontal: boolean): Layer[] {
  for (const layer of layers) {
    const ctx = layer.canvas.getContext("2d");
    if (!ctx) continue;
    const tmp = document.createElement("canvas");
    tmp.width = layer.canvas.width;
    tmp.height = layer.canvas.height;
    const tctx = tmp.getContext("2d")!;
    tctx.save();
    if (horizontal) {
      tctx.translate(layer.canvas.width, 0);
      tctx.scale(-1, 1);
    } else {
      tctx.translate(0, layer.canvas.height);
      tctx.scale(1, -1);
    }
    tctx.drawImage(layer.canvas, 0, 0);
    tctx.restore();
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    ctx.drawImage(tmp, 0, 0);
  }
  return [...layers];
}

export function invertMask(mask: SelectionMask): SelectionMask {
  const out = createEmptyMask(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) out.data[i] = mask.data[i] ? 0 : 255;
  return out;
}

export function buildSelection(
  mode: SelectionMode,
  width: number,
  height: number,
  composite: HTMLCanvasElement,
  points: Point[],
  start: Point | null,
  end: Point | null,
): SelectionMask {
  if (mode === "auto" && points[0]) {
    return maskFromAutoSelect(composite, points[0].x, points[0].y);
  }
  if (mode === "rect" && start && end) {
    return maskFromRect(width, height, start.x, start.y, end.x, end.y);
  }
  if (mode === "freehand" && points.length >= 2) {
    return maskFromPolygon(width, height, points);
  }
  return createEmptyMask(width, height);
}

export function applyAdjustmentToTarget(
  layer: Layer,
  type: AdjustmentType,
  amount: number,
  mask: SelectionMask | null,
) {
  applyAdjustment(layer, type, amount, mask);
}

export {
  beginTransform,
  commitTransform,
  drawTransformHandles,
  hitTransformHandle,
  previewTransform,
  detectQuickShape,
  drawQuickShape,
  makePerfectQuickShape,
  QUICK_SHAPE_HOLD_MS,
  QUICK_SHAPE_STILL_PX,
  sampleQuickShapePoints,
  renderTextToLayer,
  applyMaskToLayer,
  captureLayerState,
  cloneImageData,
};

export type { HandleId, TransformState, StudioMode, TextObject, AnimationFrame, SelectionMask, QuickShapeResult };
