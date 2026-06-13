import type { CustomPalette, StudioPrefs } from "./types";
import { DEFAULT_STUDIO_PREFS } from "./types";

const PREFS_KEY = "annsymons-palette-prefs";
const PALETTES_KEY = "annsymons-palette-swatches";
const LEGACY_PREFS_KEY = "annsymons-procreate-prefs";
const LEGACY_PALETTES_KEY = "annsymons-procreate-palettes";

function migrateLegacyStorage() {
  if (typeof window === "undefined") return;
  try {
    if (!localStorage.getItem(PREFS_KEY) && localStorage.getItem(LEGACY_PREFS_KEY)) {
      localStorage.setItem(PREFS_KEY, localStorage.getItem(LEGACY_PREFS_KEY)!);
    }
    if (!localStorage.getItem(PALETTES_KEY) && localStorage.getItem(LEGACY_PALETTES_KEY)) {
      localStorage.setItem(PALETTES_KEY, localStorage.getItem(LEGACY_PALETTES_KEY)!);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadStudioPrefs(): StudioPrefs {
  if (typeof window === "undefined") return DEFAULT_STUDIO_PREFS;
  migrateLegacyStorage();
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
  migrateLegacyStorage();
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
