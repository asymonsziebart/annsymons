import type { CustomPalette, StudioPrefs } from "./types";
import { DEFAULT_STUDIO_PREFS } from "./types";

const PREFS_KEY = "annsymons-procreate-prefs";
const PALETTES_KEY = "annsymons-procreate-palettes";

export function loadStudioPrefs(): StudioPrefs {
  if (typeof window === "undefined") return DEFAULT_STUDIO_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_STUDIO_PREFS;
    return { ...DEFAULT_STUDIO_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STUDIO_PREFS;
  }
}

export function saveStudioPrefs(prefs: StudioPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function loadCustomPalettes(): CustomPalette[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PALETTES_KEY);
    return raw ? (JSON.parse(raw) as CustomPalette[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomPalettes(palettes: CustomPalette[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PALETTES_KEY, JSON.stringify(palettes));
}
