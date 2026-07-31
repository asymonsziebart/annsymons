import type { Metadata, Viewport } from "next";

import CallieVallieApp from "./CallieVallieApp";
import "./callievallie.css";

export const metadata: Metadata = {
  title: "Callie & Vallie — Ann Symons",
  description:
    "An original cozy Godot farming game — explore a richly illustrated valley, grow moonberries, and play as Callie or Vallie.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#102820",
};

export default function CallieValliePage() {
  return <CallieVallieApp />;
}
