"use client";

/**
 * Minimal soft light pools for Soft UI depth (IxDF optional gradient depth).
 * Kept sparse so surfaces stay monochromatic and uncluttered.
 */
export default function PaintSplashes() {
  return (
    <div
      className="paint-splashes-root pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute -right-32 -top-24 h-72 w-72 rounded-full opacity-50 blur-3xl sm:h-96 sm:w-96"
        style={{ background: "var(--neo-light)" }}
      />
      <div
        className="absolute -bottom-28 -left-24 h-64 w-64 rounded-full opacity-35 blur-3xl sm:h-80 sm:w-80"
        style={{ background: "var(--neo-dark)" }}
      />
    </div>
  );
}
