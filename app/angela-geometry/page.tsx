import type { Metadata, Viewport } from "next";

import AngelaGeometryApp from "./AngelaGeometryApp";
import "./angela-geometry.css";

export const metadata: Metadata = {
  title: "Angela's Geometry Quest — Ann Symons",
  description:
    "Interactive geometry practice for high school students — midpoints, segment addition, equations, and more.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e3a5f",
};

export default function AngelaGeometryPage() {
  return <AngelaGeometryApp />;
}
