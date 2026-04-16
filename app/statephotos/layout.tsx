import type { Metadata } from "next";
import Link from "next/link";

import "./statephotos.css";

export const metadata: Metadata = {
  title: "US State Photos",
  robots: { index: false, follow: false },
};

export default function StatePhotosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="statephotos-app relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="site-header">
        <Link href="/statephotos" className="brand">
          US State Photos
        </Link>
        <span className="tagline">Cover on the map · gallery per state</span>
      </header>
      <div className="main">{children}</div>
    </div>
  );
}
