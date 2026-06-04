"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

/** Hides the main site footer on the tasks app so the list can use vertical space. */
export default function SiteFooter() {
  const pathname = usePathname() ?? "";
  if (
    pathname === "/tasks" ||
    pathname.startsWith("/tasks/") ||
    pathname === "/admin/truck-fund"
  ) {
    return null;
  }
  return <Footer />;
}
