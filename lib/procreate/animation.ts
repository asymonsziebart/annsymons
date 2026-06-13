import type { AnimationFrame, Layer, SerializedLayer } from "./types";
import { canvasToDataUrl, createLayerCanvas, generateId } from "./storage";
import { createRuntimeLayer } from "./types";

export function captureFrameLayers(layers: Layer[]): SerializedLayer[] {
  return layers.map((l) => ({
    id: l.id,
    name: l.name,
    visible: l.visible,
    opacity: l.opacity,
    blendMode: l.blendMode,
    locked: l.locked,
    alphaLock: l.alphaLock,
    clipToLayerId: l.clipToLayerId,
    groupId: l.groupId,
    imageData: canvasToDataUrl(l.canvas),
  }));
}

export async function loadFrameLayers(
  frame: AnimationFrame,
  width: number,
  height: number,
  dataUrlToImage: (url: string) => Promise<HTMLImageElement>,
): Promise<Layer[]> {
  return Promise.all(
    frame.layers.map(async (sl) => {
      const layer = createRuntimeLayer(sl, width, height);
      if (sl.imageData) {
        const img = await dataUrlToImage(sl.imageData);
        const ctx = layer.canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
      }
      return layer;
    }),
  );
}

export function createAnimationFrame(layers: Layer[], label?: string): AnimationFrame {
  return {
    id: generateId(),
    label: label ?? `Frame ${Date.now()}`,
    layers: captureFrameLayers(layers),
  };
}
