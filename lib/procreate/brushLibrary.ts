import { BRUSHES } from "./brushes";
import type { BrushDef, BrushCategory } from "./types";
import type { ImportedBrushSet } from "./brushImport";
import { listImportedBrushSets } from "./storage";

export async function getAllBrushes(): Promise<BrushDef[]> {
  const imported = await listImportedBrushSets();
  const importedBrushes = imported.flatMap((s) => s.brushes);
  return [...BRUSHES, ...importedBrushes];
}

export function findBrushInList(brushes: BrushDef[], id: string): BrushDef {
  return brushes.find((b) => b.id === id) ?? brushes[0] ?? BRUSHES[0];
}

export function getBrushesByCategoryFromList(
  brushes: BrushDef[],
  category: BrushCategory,
): BrushDef[] {
  return brushes.filter((b) => b.category === category);
}

export function getImportedSetNames(brushes: BrushDef[]): string[] {
  const names = new Set<string>();
  for (const b of brushes) {
    if (b.setName) names.add(b.setName);
  }
  return [...names];
}

const tipImageCache = new Map<string, HTMLImageElement>();

export function preloadBrushTip(brush: BrushDef): Promise<void> {
  if (!brush.tipImage) return Promise.resolve();
  const cached = tipImageCache.get(brush.id);
  if (cached?.complete) return Promise.resolve();

  return new Promise((resolve) => {
    const img = cached ?? new Image();
    img.onload = () => {
      tipImageCache.set(brush.id, img);
      resolve();
    };
    img.onerror = () => resolve();
    if (!cached) {
      img.src = brush.tipImage!;
      tipImageCache.set(brush.id, img);
    }
  });
}

export function getCachedTipImage(brush: BrushDef): HTMLImageElement | null {
  if (!brush.tipImage) return null;
  const img = tipImageCache.get(brush.id);
  if (img?.complete && img.naturalWidth > 0) return img;
  return null;
}

export async function preloadBrushSet(set: ImportedBrushSet): Promise<void> {
  await Promise.all(set.brushes.map((b) => preloadBrushTip(b)));
}

export function clearTipCacheForSet(set: ImportedBrushSet): void {
  for (const b of set.brushes) tipImageCache.delete(b.id);
}
