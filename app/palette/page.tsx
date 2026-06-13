import type { Metadata, Viewport } from "next";
import PaletteApp from "@/components/procreate/PaletteApp";
import "../procreate/procreate.css";

export const metadata: Metadata = {
  title: "Palette — Ann Symons",
  description:
    "Palette — a web-based digital art studio with brushes, layers, colors, and gallery.",
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

export default function PalettePage() {
  return <PaletteApp />;
}
