"use client";

/**
 * Soft ambient light orbs for neumorphic depth. Pure CSS, no images.
 */
export default function PaintSplashes() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {/* Soft highlight – top right */}
      <div
        className="absolute -right-28 -top-20 h-64 w-64 rounded-full opacity-40 blur-3xl sm:-right-24 sm:-top-28 sm:h-80 sm:w-80 sm:opacity-50"
        style={{ background: "var(--neo-light)" }}
      />
      {/* Cool shadow pool – bottom left */}
      <div
        className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full opacity-30 blur-3xl sm:-bottom-28 sm:-left-20 sm:h-72 sm:w-72 sm:opacity-40"
        style={{ background: "var(--color-splash-teal)" }}
      />
      {/* Mid soft fill – left */}
      <div
        className="absolute -left-12 top-1/3 h-44 w-44 rounded-full opacity-25 blur-3xl sm:left-0 sm:h-52 sm:w-52 sm:opacity-30"
        style={{ background: "var(--color-splash-coral)" }}
      />
      {/* Subtle lift – bottom right */}
      <div
        className="absolute -right-12 bottom-1/4 h-40 w-40 rounded-full opacity-25 blur-3xl sm:right-0 sm:h-48 sm:w-48 sm:opacity-35"
        style={{ background: "var(--neo-light)" }}
      />
    </div>
  );
}
