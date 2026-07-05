type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

export function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function isFullscreenSupported(): boolean {
  const el = document.documentElement as FullscreenElement;
  return typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function";
}

export async function enterFullscreen(): Promise<boolean> {
  const el = document.documentElement as FullscreenElement;
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
  if (!request) return false;
  try {
    await request.call(el);
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(): Promise<void> {
  const doc = document as FullscreenDocument;
  const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
  if (!exit) return;
  try {
    await exit.call(document);
  } catch {
    /* ignore */
  }
}

export async function toggleFullscreen(): Promise<boolean> {
  if (getFullscreenElement()) {
    await exitFullscreen();
    return false;
  }
  return enterFullscreen();
}
