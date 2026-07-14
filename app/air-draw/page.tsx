import type { Metadata, Viewport } from "next";

import AirDrawApp from "./AirDrawApp";
import "./air-draw.css";

export const metadata: Metadata = {
  title: "Air Draw — Ann Symons",
  description:
    "Draw in the air with your fingertip using your webcam. Hand-tracked neon canvas — camera stays on your device.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050608",
};

export default function AirDrawPage() {
  return <AirDrawApp />;
}
