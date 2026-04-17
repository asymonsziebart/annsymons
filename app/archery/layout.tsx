import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Archery",
  description: "Projector targets and camera scoring — private practice page.",
  robots: { index: false, follow: false },
};

export default function ArcheryLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#0c0f0d] text-[#e8eee9]">
      <header className="border-b border-white/10 bg-black/30 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold tracking-tight text-[#c8e6c9]">Archery range</span>
          <Link
            href="/"
            className="text-sm text-white/50 transition-colors hover:text-[#81c784]"
          >
            annsymons.com
          </Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
