"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const navLinks = [
  { href: "/blog", label: "Blog" },
  { href: "/recipes", label: "Recipes" },
  { href: "/interests", label: "Interests" },
] as const;

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 pt-[env(safe-area-inset-top)] backdrop-blur-md"
    >
      <div className="mx-auto flex h-[3.75rem] max-w-5xl items-center justify-between gap-3 px-4 sm:h-20 sm:gap-4 sm:px-8">
        <Link
          href="/"
          className="font-heading min-h-11 min-w-0 shrink text-lg font-semibold text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)] sm:text-xl"
        >
          Ann Symons
        </Link>
        <nav
          className="hidden items-center gap-6 md:flex md:gap-8"
          aria-label="Main"
        >
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="link-accent text-sm font-medium text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
            >
              {label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="touch-manipulation rounded-lg p-2 text-[var(--color-ink-muted)] hover:bg-[var(--color-cream-dark)] hover:text-[var(--color-ink)] md:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-main-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
          {menuOpen ? (
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          ) : (
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
      {menuOpen ? (
        <div
          id="mobile-main-nav"
          className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 shadow-lg backdrop-blur-md md:hidden"
        >
          <nav
            className="mx-auto flex max-w-5xl flex-col px-4 py-3 sm:px-8"
            aria-label="Main"
          >
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="link-accent touch-manipulation rounded-lg px-2 py-3 text-base font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-cream-dark)]/60 hover:text-[var(--color-ink)]"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
