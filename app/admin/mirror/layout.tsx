import type { Metadata, Viewport } from "next";

import MirrorBodyLock from "./MirrorBodyLock";
import "./mirror.css";

export const metadata: Metadata = {
  title: "Mirror",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function MirrorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <MirrorBodyLock />
      <div className="mirror-app">{children}</div>
    </>
  );
}
