export type Tool = "paint" | "smudge" | "erase";

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
  | "elements";

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
  texture: "smooth" | "grain" | "speckle" | "canvas";
  taper: number;
};

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  locked: boolean;
  canvas: HTMLCanvasElement;
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
};

export type SerializedLayer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  locked: boolean;
  imageData: string;
};

export type HistoryEntry = {
  layerId: string;
  imageData: ImageData;
};

export type StudioPrefs = {
  lightInterface: boolean;
  rightHanded: boolean;
  brushCursor: boolean;
  showInterface: boolean;
};

export type Point = { x: number; y: number; pressure: number };
