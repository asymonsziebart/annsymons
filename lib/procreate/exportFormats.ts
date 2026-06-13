import { compositeLayers } from "./canvasEngine";
import type { Layer } from "./types";

export function exportCompositePng(
  layers: Layer[],
  width: number,
  height: number,
  backgroundColor: string,
  filename: string,
) {
  const composite = compositeLayers(layers, width, height, backgroundColor);
  downloadDataUrl(composite.toDataURL("image/png"), filename.endsWith(".png") ? filename : `${filename}.png`);
}

export function exportCompositeJpeg(
  layers: Layer[],
  width: number,
  height: number,
  backgroundColor: string,
  filename: string,
  quality = 0.92,
) {
  const composite = compositeLayers(layers, width, height, backgroundColor);
  downloadDataUrl(
    composite.toDataURL("image/jpeg", quality),
    filename.endsWith(".jpg") || filename.endsWith(".jpeg") ? filename : `${filename}.jpg`,
  );
}

/** Flattened multi-layer export as layered JSON + PNGs (portable project bundle). */
export function exportProjectJson(
  doc: { name: string; width: number; height: number; backgroundColor: string },
  layers: Layer[],
) {
  const payload = {
    version: 1,
    name: doc.name,
    width: doc.width,
    height: doc.height,
    backgroundColor: doc.backgroundColor,
    layers: layers.map((l) => ({
      name: l.name,
      opacity: l.opacity,
      blendMode: l.blendMode,
      imageData: l.canvas.toDataURL("image/png"),
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${doc.name}.palette.json`);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
