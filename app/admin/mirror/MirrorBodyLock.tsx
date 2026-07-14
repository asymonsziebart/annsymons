"use client";

import { useEffect } from "react";

import { bindMirrorGestures } from "./mirrorGestures";
import { bindMirrorTypography } from "./mirrorScale";

function bindGesturesWhenReady(): () => void {
  let stopped = false;
  let unbind: (() => void) | undefined;
  let tries = 0;
  let timer: number | null = null;

  const attempt = () => {
    if (stopped) return;
    if (!document.querySelector(".mirror-app__inner")) {
      if (tries < 40) {
        tries += 1;
        timer = window.setTimeout(attempt, 50);
      }
      return;
    }
    unbind = bindMirrorGestures();
  };
  attempt();

  return () => {
    stopped = true;
    if (timer != null) window.clearTimeout(timer);
    unbind?.();
  };
}

/** Lock html/body to full black on cheap Android tablets where :has() / dvh can fail. */
export default function MirrorBodyLock() {
  useEffect(() => {
    document.documentElement.classList.add("mirror-active");
    document.body.classList.add("mirror-active");
    const unbindTypography = bindMirrorTypography();
    const unbindGestures = bindGesturesWhenReady();
    return () => {
      unbindGestures();
      unbindTypography();
      document.documentElement.classList.remove("mirror-active");
      document.body.classList.remove("mirror-active");
    };
  }, []);

  return null;
}
