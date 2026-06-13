import { redirect } from "next/navigation";

/** Legacy URL — Palette lives at /palette */
export default function ProcreateRedirectPage() {
  redirect("/palette");
}
