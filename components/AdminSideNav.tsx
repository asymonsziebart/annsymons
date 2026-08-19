"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_NAV_PAGES } from "@/lib/admin/navPages";
import { isPokemonCardsPath } from "@/lib/isPokemonCardsPath";

const STORAGE_KEY = "admin-side-nav-collapsed";

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  /** null = full shared-admin access; array = approved account allowlist */
  allowedHrefs?: string[] | null;
  showManageUsers?: boolean;
};

export default function AdminSideNav({
  allowedHrefs = null,
  showManageUsers = false,
}: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const immersiveMobile = isPokemonCardsPath(pathname);

  if (pathname === "/admin/login") {
    return null;
  }

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const sidebarPages = ADMIN_NAV_PAGES.filter((page) => {
    if (
      page.href === "/admin/posts/new" ||
      page.href === "/admin/recipes/new" ||
      page.href === "/admin/gallery"
    ) {
      return false;
    }
    if (page.href === "/admin/users") return showManageUsers;
    if (allowedHrefs == null) return true;
    if (page.href === "/admin") return allowedHrefs.length > 0;
    return allowedHrefs.includes(page.href);
  });

  const nav = (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2 py-3" aria-label="Admin pages">
      {sidebarPages.map((page) => {
        const active = isActivePath(pathname, page.href);
        return (
          <Link
            key={page.href}
            href={page.href}
            title={page.description}
            className={`rounded-xl px-3 py-2.5 text-sm transition-[box-shadow,color] duration-200 ${
              active
                ? "font-semibold text-[var(--color-accent)] shadow-[var(--neo-shadow-in-sm)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:shadow-[var(--neo-shadow-out-sm)]"
            } ${collapsed ? "text-center" : ""}`}
          >
            {collapsed ? (
              <span className="block truncate text-xs font-semibold leading-tight">
                {page.label
                  .split(/\s+/)
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 3)
                  .toUpperCase()}
              </span>
            ) : (
              <>
                <span className="block font-medium">{page.label}</span>
                <span className={`mt-0.5 block text-xs leading-snug ${active ? "text-[var(--color-accent)]/80" : "text-[var(--color-muted)]"}`}>
                  {page.description}
                </span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile open button — hidden on immersive full-screen admin apps */}
      {!immersiveMobile ? (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="neo-btn-primary fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-[90] !rounded-full lg:hidden"
          aria-label="Open admin menu"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 6h16M4 12h10M4 18h16" strokeLinecap="round" />
          </svg>
          Admin
        </button>
      ) : null}

      {/* Mobile drawer */}
      {!immersiveMobile && mobileOpen ? (
        <div className="fixed inset-0 z-[95] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--color-ink)]/25"
            aria-label="Close admin menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="neo absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col !rounded-none">
            <div className="flex items-center justify-between px-3 py-3 shadow-[inset_0_-1px_0_var(--color-border)]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]">Admin</p>
                <p className="font-heading text-base font-semibold text-[var(--color-ink)]">Pages</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="neo-btn !min-h-10 !min-w-10 !p-0"
                aria-label="Close admin menu"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}

      {/* Desktop collapsible rail */}
      <aside
        className={`relative z-20 hidden shrink-0 flex-col bg-[var(--neo-bg)] shadow-[6px_0_16px_var(--neo-dark-soft)] transition-[width] duration-200 lg:flex ${
          ready && collapsed ? "w-[4.25rem]" : "w-64"
        }`}
        aria-label="Admin side menu"
      >
        <div className={`flex items-center px-2 py-3 shadow-[inset_0_-1px_0_var(--color-border)] ${collapsed ? "justify-center" : "justify-between gap-2 px-3"}`}>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]">Admin</p>
              <p className="truncate font-heading text-sm font-semibold text-[var(--color-ink)]">Pages</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="neo-btn !min-h-10 !min-w-10 !p-0"
            aria-label={collapsed ? "Expand admin menu" : "Collapse admin menu"}
            aria-expanded={!collapsed}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {collapsed ? (
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>
        {nav}
      </aside>
    </>
  );
}
