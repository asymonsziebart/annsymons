"use client";

import { usePathname } from "next/navigation";
import { isPokemonCardsPath } from "@/lib/isPokemonCardsPath";
import Footer from "./Footer";

/** Hides the main site footer on full-screen admin apps. */
export default function SiteFooter() {
  const pathname = usePathname() ?? "";
  if (
    pathname === "/tasks" ||
    pathname.startsWith("/tasks/") ||
    pathname === "/admin/truck-fund" ||
    isPokemonCardsPath(pathname)
  ) {
    return null;
  }
  return <Footer />;
}
