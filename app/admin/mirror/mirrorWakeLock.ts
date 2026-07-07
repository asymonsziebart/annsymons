type WakeLockSentinelWithRelease = WakeLockSentinel & {
  release: () => Promise<void>;
};

let activeLock: WakeLockSentinelWithRelease | null = null;

export function isWakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

/** Ask the OS to keep the screen on while the mirror tab is active. */
export async function requestMirrorWakeLock(): Promise<boolean> {
  if (!isWakeLockSupported()) return false;

  try {
    if (activeLock && !activeLock.released) return true;
    activeLock = (await navigator.wakeLock.request("screen")) as WakeLockSentinelWithRelease;
    activeLock.addEventListener("release", () => {
      activeLock = null;
    });
    return true;
  } catch {
    return false;
  }
}

export async function releaseMirrorWakeLock(): Promise<void> {
  if (!activeLock || activeLock.released) return;
  try {
    await activeLock.release();
  } catch {
    /* ignore */
  }
  activeLock = null;
}

/** Re-acquire after tab visibility returns (browser drops wake locks when hidden). */
export function bindMirrorWakeLockOnVisible(): () => void {
  const onVisible = () => {
    if (document.visibilityState === "visible") void requestMirrorWakeLock();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}
