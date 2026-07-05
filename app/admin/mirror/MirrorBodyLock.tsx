"use client";

import { useEffect } from "react";

/** Lock html/body to full black on cheap Android tablets where :has() / dvh can fail. */
export default function MirrorBodyLock() {
  useEffect(() => {
    document.documentElement.classList.add("mirror-active");
    document.body.classList.add("mirror-active");
    return () => {
      document.documentElement.classList.remove("mirror-active");
      document.body.classList.remove("mirror-active");
    };
  }, []);

  return null;
}
