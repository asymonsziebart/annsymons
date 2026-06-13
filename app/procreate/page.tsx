import type { Metadata, Viewport } from "next";
import ProcreateApp from "@/components/procreate/ProcreateApp";
import "./procreate.css";

export const metadata: Metadata = {
  title: "Procreate — Ann Symons",
  description:
    "A web-based digital art studio inspired by Procreate for iPad — brushes, layers, colors, and gallery.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1c1c1e",
};

export default function ProcreatePage() {
  return <ProcreateApp />;
}
