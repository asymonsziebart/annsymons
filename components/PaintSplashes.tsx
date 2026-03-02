"use client";

/**
 * Decorative paint-splash blobs for the background. Pure CSS, no images.
 */
export default function PaintSplashes() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {/* Large soft blob – top right */}
      <div
        className="absolute -right-32 -top-32 h-80 w-80 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--color-splash-coral)" }}
      />
      {/* Medium blob – bottom left */}
      <div
        className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--color-splash-teal)" }}
      />
      {/* Smaller blob – middle left */}
      <div
        className="absolute left-0 top-1/3 h-48 w-48 rounded-full opacity-20 blur-2xl"
        style={{ background: "var(--color-splash-mustard)" }}
      />
      {/* Small accent – bottom right */}
      <div
        className="absolute bottom-1/4 right-0 h-40 w-40 rounded-full opacity-20 blur-2xl"
        style={{ background: "var(--color-splash-coral)" }}
      />
    </div>
  );
}
