import type { Metadata, Viewport } from "next";

import CallieVallieApp from "./CallieVallieApp";
import "./callievallie.css";

export const metadata: Metadata = {
  title: "Callie & Vallie — Ann Symons",
  description:
    "A cozy farming life sim in a small valley — farm, fish, cook, and befriend Callie, Vallie, and the townsfolk.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2f4f3a",
};

export default function CallieValliePage() {
  return <CallieVallieApp />;
}
