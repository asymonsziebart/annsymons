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
        className="absolute -right-36 -top-24 h-60 w-60 rounded-full opacity-25 blur-3xl sm:-right-32 sm:-top-32 sm:h-80 sm:w-80 sm:opacity-30"
        style={{ background: "var(--color-splash-coral)" }}
      />
      {/* Medium blob – bottom left */}
      <div
        className="absolute -bottom-20 -left-28 h-52 w-52 rounded-full opacity-20 blur-3xl sm:-bottom-24 sm:-left-24 sm:h-64 sm:w-64 sm:opacity-25"
        style={{ background: "var(--color-splash-teal)" }}
      />
      {/* Smaller blob – middle left */}
      <div
        className="absolute -left-16 top-1/3 h-40 w-40 rounded-full opacity-15 blur-2xl sm:left-0 sm:h-48 sm:w-48 sm:opacity-20"
        style={{ background: "var(--color-splash-mustard)" }}
      />
      {/* Small accent – bottom right */}
      <div
        className="absolute -right-16 bottom-1/4 h-36 w-36 rounded-full opacity-15 blur-2xl sm:right-0 sm:h-40 sm:w-40 sm:opacity-20"
        style={{ background: "var(--color-splash-coral)" }}
      />
    </div>
  );
}
