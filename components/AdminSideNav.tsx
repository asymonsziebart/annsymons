"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_NAV_PAGES } from "@/lib/admin/navPages";

const STORAGE_KEY = "admin-side-nav-collapsed";

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSideNav() {
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

  const sidebarPages = ADMIN_NAV_PAGES.filter(
    (page) =>
      page.href !== "/admin/posts/new" &&
      page.href !== "/admin/recipes/new" &&
      page.href !== "/admin/gallery"
  );

  const nav = (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2 py-3" aria-label="Admin pages">
      {sidebarPages.map((page) => {
        const active = isActivePath(pathname, page.href);
        return (
          <Link
            key={page.href}
            href={page.href}
            title={page.description}
            className={`rounded-lg px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-stone-800 font-semibold text-white"
                : "text-stone-700 hover:bg-stone-200/80 hover:text-stone-950"
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
                <span className={`mt-0.5 block text-xs leading-snug ${active ? "text-stone-300" : "text-stone-500"}`}>
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
      {/* Mobile open button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-[90] inline-flex min-h-12 items-center gap-2 rounded-full bg-stone-900 px-4 py-3 text-sm font-semibold text-white shadow-lg lg:hidden"
        aria-label="Open admin menu"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M4 6h16M4 12h10M4 18h16" strokeLinecap="round" />
        </svg>
        Admin
      </button>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[95] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-stone-950/40"
            aria-label="Close admin menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-stone-200 bg-[var(--color-cream)] shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-3 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Admin</p>
                <p className="font-heading text-base font-semibold text-stone-950">Pages</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-200"
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
        className={`relative z-20 hidden shrink-0 flex-col border-r border-stone-200 bg-[var(--color-cream)]/95 backdrop-blur-sm transition-[width] duration-200 lg:flex ${
          ready && collapsed ? "w-[4.25rem]" : "w-64"
        }`}
        aria-label="Admin side menu"
      >
        <div className={`flex items-center border-b border-stone-200 px-2 py-3 ${collapsed ? "justify-center" : "justify-between gap-2 px-3"}`}>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-stone-500">Admin</p>
              <p className="truncate font-heading text-sm font-semibold text-stone-950">Pages</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-200 hover:text-stone-950"
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
