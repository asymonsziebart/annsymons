"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const navLinks = [
  { href: "/recipes", label: "Recipes" },
  { href: "/home-video-saver", label: "DVD Saver" },
  { href: "/air-draw", label: "Air Draw" },
  { href: "/holo-ttt", label: "Holo TTT" },
  { href: "/interests", label: "Interests" },
] as const;

export default function Header() {
  const pathname = usePathname();
  const isTasksApp =
    pathname === "/tasks" || (pathname != null && pathname.startsWith("/tasks/"));
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen || isTasksApp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, isTasksApp]);

  useEffect(() => {
    if (!menuOpen || isTasksApp) return;
    const close = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen, isTasksApp]);

  return (
    <header
      ref={headerRef}
      className="neo-nav sticky top-0 z-50 pt-[env(safe-area-inset-top)]"
    >
      <div
        className={
          isTasksApp
            ? "mx-auto flex h-12 max-w-5xl items-center justify-between gap-2 px-2.5 sm:px-3 md:h-[3.75rem] md:gap-3 md:px-6 lg:h-20 lg:gap-4 lg:px-8"
            : "mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:h-20 sm:gap-4 sm:px-8"
        }
      >
        <Link
          href="/"
          className={
            isTasksApp
              ? "font-heading min-h-0 min-w-0 shrink text-base font-semibold leading-tight text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)] md:min-h-11 md:text-lg md:leading-normal lg:text-xl"
              : "font-heading min-h-11 min-w-0 shrink text-lg font-semibold leading-tight text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)] sm:text-xl"
          }
        >
          Ann Symons
        </Link>
        <nav
          className="hidden items-center gap-2 md:flex md:gap-3"
          aria-label="Main"
        >
          {navLinks.map(({ href, label }) => {
            const active =
              pathname === href || (pathname != null && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition-[box-shadow,color,transform] duration-200 ${
                  active
                    ? "text-[var(--color-accent)] shadow-[var(--neo-shadow-in-sm)]"
                    : "neo-link hover:shadow-[var(--neo-shadow-out-sm)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        {!isTasksApp ? (
          <button
            type="button"
            className="neo-btn touch-manipulation !min-h-11 !min-w-11 !rounded-full !p-2 text-[var(--color-ink-muted)] md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-main-nav"
            aria-pressed={menuOpen}
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
        ) : null}
      </div>
      {!isTasksApp && menuOpen ? (
        <div
          id="mobile-main-nav"
          className="border-t border-[var(--color-border)]/60 bg-[var(--neo-bg)] md:hidden"
        >
          <nav
            className="mx-auto flex max-w-5xl flex-col gap-1.5 px-4 py-3 sm:px-8"
            aria-label="Main"
          >
            {navLinks.map(({ href, label }) => {
              const active =
                pathname === href ||
                (pathname != null && pathname.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex min-h-12 touch-manipulation items-center rounded-xl px-3 py-3 text-base font-semibold ${
                    active
                      ? "text-[var(--color-accent)] shadow-[var(--neo-shadow-in-sm)]"
                      : "neo-link"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
