import type { Metadata, Viewport } from "next";

import "./mirror.css";

export const metadata: Metadata = {
  title: "Mirror",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function MirrorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="mirror-app">{children}</div>;
}
