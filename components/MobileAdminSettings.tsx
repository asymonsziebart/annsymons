"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  isAdmin?: boolean;
};

export default function MobileAdminSettings({ isAdmin = false }: Props) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (!isHome || isAdmin) return null;

  return (
    <Link
      href="/admin"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[100] lg:hidden"
      aria-label="Open settings login"
    >
      <span className="flex min-h-14 items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-3 text-white shadow-2xl ring-2 ring-white/80 transition-transform active:scale-95">
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
        <span className="text-sm font-semibold">Settings</span>
      </span>
    </Link>
  );
}
