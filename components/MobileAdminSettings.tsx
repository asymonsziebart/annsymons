"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const adminLinks = [
  { href: "/tasks", label: "Tasks", description: "Private task board" },
  { href: "/statephotos", label: "State Photos", description: "Map photo manager" },
  { href: "/archery", label: "Archery", description: "Hidden practice page" },
  { href: "/admin", label: "Admin", description: "Site content tools" },
] as const;

export default function MobileAdminSettings() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 md:hidden"
    >
      {open ? (
        <div
          id="mobile-admin-settings-menu"
          className="mb-3 w-[min(calc(100vw-2rem),18rem)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 shadow-2xl backdrop-blur-md"
        >
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <p className="font-heading text-base font-semibold text-[var(--color-ink)]">
              Admin pages
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Quick links for private tools
            </p>
          </div>
          <nav className="p-2" aria-label="Admin pages">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-cream-dark)]/70"
                onClick={() => setOpen(false)}
              >
                <span className="block text-sm font-semibold text-[var(--color-ink)]">
                  {link.label}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                  {link.description}
                </span>
              </Link>
            ))}
          </nav>
        </div>
      ) : null}

      <button
        type="button"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-ink)] text-white shadow-xl ring-1 ring-black/10 transition-transform active:scale-95"
        aria-label={open ? "Close admin pages menu" : "Open admin pages menu"}
        aria-expanded={open}
        aria-controls="mobile-admin-settings-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path
            d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2.1 2.1 0 0 1-2.97 2.97l-.06-.06A1.8 1.8 0 0 0 14.8 19.6a1.8 1.8 0 0 0-1.3 1.72V21.5a2.1 2.1 0 0 1-4.2 0v-.09A1.8 1.8 0 0 0 8 19.7a1.8 1.8 0 0 0-1.98.36l-.06.06a2.1 2.1 0 0 1-2.97-2.97l.06-.06A1.8 1.8 0 0 0 3.4 15.1a1.8 1.8 0 0 0-1.72-1.3H1.5a2.1 2.1 0 0 1 0-4.2h.09A1.8 1.8 0 0 0 3.3 8.3a1.8 1.8 0 0 0-.36-1.98l-.06-.06A2.1 2.1 0 0 1 5.85 3.3l.06.06A1.8 1.8 0 0 0 7.9 3.7a1.8 1.8 0 0 0 1.3-1.72V1.8a2.1 2.1 0 0 1 4.2 0v.09a1.8 1.8 0 0 0 1.3 1.72 1.8 1.8 0 0 0 1.98-.36l.06-.06a2.1 2.1 0 0 1 2.97 2.97l-.06.06A1.8 1.8 0 0 0 19.7 8.2a1.8 1.8 0 0 0 1.72 1.3h.08a2.1 2.1 0 0 1 0 4.2h-.09A1.8 1.8 0 0 0 19.4 15Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
