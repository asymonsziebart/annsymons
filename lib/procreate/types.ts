export type DrawingTool = "paint" | "smudge" | "erase";

/** @deprecated use DrawingTool for strokes; studio uses StudioMode for UI */
export type Tool = DrawingTool;

export type StudioMode = "draw" | "select" | "transform" | "text";

export type SelectionMode = "freehand" | "rect" | "auto";

export type SymmetryMode = "none" | "vertical" | "horizontal" | "quad";

export type AdjustmentType =
  | "blur"
  | "sharpen"
  | "noise"
  | "hue"
  | "saturation"
  | "brightness"
  | "opacity";

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export type ColorTab = "disc" | "classic" | "value" | "palettes";

export type CanvasPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  dpi: number;
};

export type BrushCategory =
  | "sketching"
  | "inking"
  | "painting"
  | "artistic"
  | "calligraphy"
  | "textures"
  | "elements"
  | "imported";

export type BrushTexture = "smooth" | "grain" | "speckle" | "canvas" | "chalk" | "halftone";

export type BrushStampShape =
  | "circle"
  | "flat"
  | "square"
  | "hair"
  | "pixel"
  | "crosshatch"
  | "spray"
  | "star"
  | "ribbon";

export type BrushStampBlend = "normal" | "screen" | "multiply" | "overlay";

export type BrushDef = {
  id: string;
  name: string;
  category: BrushCategory;
  preview: string;
  size: number;
  opacity: number;
  spacing: number;
  flow: number;
  hardness: number;
  scatter: number;
  streamline: number;
  wetMix: number;
  texture: BrushTexture;
  taper: number;
  /** Stamp footprint — default circle uses texture rendering */
  shape?: BrushStampShape;
  /** Width-to-height ratio for flat / ribbon brushes */
  aspectRatio?: number;
  /** Rotate flat shapes along stroke direction */
  rotationFollowStroke?: boolean;
  /** Random rotation wobble per stamp (radians) */
  angleJitter?: number;
  /** Per-stamp compositing (neon, bokeh, etc.) */
  stampBlend?: BrushStampBlend;
  /** Soft outer glow pass (0–1) */
  glow?: number;
  /** Ink bleed / color pull duplicate stamp (0–1) */
  bleed?: number;
  tipImage?: string;
  setName?: string;
  imported?: boolean;
};

export type BrushOverrides = Partial<
  Pick<BrushDef, "size" | "opacity" | "spacing" | "flow" | "hardness" | "scatter" | "streamline" | "wetMix" | "taper">
>;

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  locked: boolean;
  alphaLock: boolean;
  clipToLayerId: string | null;
  groupId: string | null;
  canvas: HTMLCanvasElement;
};

export type SerializedLayer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  locked: boolean;
  alphaLock?: boolean;
  clipToLayerId?: string | null;
  groupId?: string | null;
  imageData: string;
};

export type AnimationFrame = {
  id: string;
  label: string;
  layers: SerializedLayer[];
};

export type TextObject = {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  layerId: string;
};

export type ArtworkMeta = {
  id: string;
  name: string;
  width: number;
  height: number;
  createdAt: number;
  modifiedAt: number;
  thumbnail: string;
};

export type ArtworkDocument = ArtworkMeta & {
  layers: SerializedLayer[];
  backgroundColor: string;
  animationFrames?: AnimationFrame[];
  currentFrameIndex?: number;
  referenceImage?: string | null;
  textObjects?: TextObject[];
};

export type SelectionMask = {
  width: number;
  height: number;
  /** 0 = not selected, 255 = selected */
  data: Uint8Array;
};

export type SelectionState = {
  mask: SelectionMask;
  bounds: { x: number; y: number; w: number; h: number } | null;
};

export type TransformState = {
  layerId: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  /** Snapshot before transform for live preview */
  source: ImageData;
};

export type StudioPrefs = {
  lightInterface: boolean;
  rightHanded: boolean;
  brushCursor: boolean;
  showInterface: boolean;
  colorDropThreshold: number;
  colorDropReference: boolean;
  symmetry: SymmetryMode;
  quickShape: boolean;
  onionSkin: boolean;
  showReference: boolean;
};

export type CustomPalette = {
  id: string;
  name: string;
  colors: string[];
};

export type Point = { x: number; y: number; pressure: number };

export const DEFAULT_STUDIO_PREFS: StudioPrefs = {
  lightInterface: false,
  rightHanded: false,
  brushCursor: true,
  showInterface: true,
  colorDropThreshold: 0.18,
  colorDropReference: true,
  symmetry: "none",
  quickShape: true,
  onionSkin: false,
  showReference: true,
};

export function normalizeLayerFields(sl: SerializedLayer): SerializedLayer {
  return {
    ...sl,
    alphaLock: sl.alphaLock ?? false,
    clipToLayerId: sl.clipToLayerId ?? null,
    groupId: sl.groupId ?? null,
  };
}

export function createRuntimeLayer(
  sl: SerializedLayer,
  width: number,
  height: number,
  canvas?: HTMLCanvasElement,
): Layer {
  const c = canvas ?? document.createElement("canvas");
  if (!canvas) {
    c.width = width;
    c.height = height;
  }
  const norm = normalizeLayerFields(sl);
  return {
    id: norm.id,
    name: norm.name,
    visible: norm.visible,
    opacity: norm.opacity,
    blendMode: norm.blendMode,
    locked: norm.locked,
    alphaLock: norm.alphaLock ?? false,
    clipToLayerId: norm.clipToLayerId ?? null,
    groupId: norm.groupId ?? null,
    canvas: c,
  };
}
