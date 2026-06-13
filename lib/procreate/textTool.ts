import type { Layer, TextObject } from "./types";

export function renderTextToLayer(layer: Layer, obj: TextObject) {
  const ctx = layer.canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.font = `${obj.fontSize}px ${obj.fontFamily}, system-ui, sans-serif`;
  ctx.fillStyle = obj.color;
  ctx.textBaseline = "top";
  ctx.fillText(obj.text, obj.x, obj.y);
  ctx.restore();
}

export function renderAllText(layer: Layer, objects: TextObject[]) {
  for (const obj of objects.filter((t) => t.layerId === layer.id)) {
    renderTextToLayer(layer, obj);
  }
}
