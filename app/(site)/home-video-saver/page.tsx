import type { Metadata } from "next";

import { HOME_VIDEO_SAVER_VERSION } from "@/lib/homeVideoSaverBundle";

export const metadata: Metadata = {
  title: "Home Video Saver — DVD to MP4",
  description:
    "Download a simple desktop app that converts personal home-video DVDs into cloud-ready MP4 files.",
};

const steps = [
  {
    number: "1",
    title: "Insert and scan",
    text: "Choose your DVD drive or a saved VIDEO_TS folder. The app finds each recording.",
  },
  {
    number: "2",
    title: "Choose what to save",
    text: "Convert one recording or every title on the disc, with a quality setting you control.",
  },
  {
    number: "3",
    title: "Move it to the cloud",
    text: "Check the finished MP4, then upload it to Google Drive, iCloud, OneDrive, or your preferred cloud.",
  },
] as const;

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DiscIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.25" />
      <path d="M14 4.2A8 8 0 0 1 19.8 10M4.2 14A8 8 0 0 0 10 19.8" strokeLinecap="round" />
    </svg>
  );
}

export default function HomeVideoSaverPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.03fr_.97fr] lg:gap-14">
        <div>
          <div className="neo-chip mb-7 !text-[var(--color-accent)]">
            <DiscIcon />
            Private, on-device conversion
          </div>
          <h1 className="font-heading text-4xl font-bold leading-[1.08] tracking-tight text-[var(--color-ink)] sm:text-5xl">
            Give old home videos a new home.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--color-ink-muted)]">
            Home Video Saver turns personal DVDs into MP4 files you can keep,
            share, and back up to the cloud. Your footage stays on your computer.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <a
              href="/api/downloads/home-video-saver"
              download
              className="neo-btn-primary !min-h-14 !px-6 !text-base"
            >
              <DownloadIcon />
              Download the app
            </a>
            <span className="text-sm font-semibold text-[var(--color-ink-muted)]">
              Version {HOME_VIDEO_SAVER_VERSION} · Windows &amp; macOS · Free
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
            Requires{" "}
            <a
              className="font-bold text-[var(--color-accent)] underline decoration-2 underline-offset-2"
              href="https://www.python.org/downloads/"
              target="_blank"
              rel="noreferrer"
            >
              Python 3
            </a>{" "}
            and the official{" "}
            <a
              className="font-bold text-[var(--color-accent)] underline decoration-2 underline-offset-2"
              href="https://handbrake.fr/downloads2.php"
              target="_blank"
              rel="noreferrer"
            >
              HandBrake command-line app
            </a>
            . Setup instructions are included.
          </p>
        </div>

        <div className="neo-lg overflow-hidden p-4 sm:p-6" aria-label="Home Video Saver app preview">
          <div className="rounded-2xl bg-[#f7f9fc] p-5 shadow-[var(--neo-shadow-in-sm)] sm:p-6">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-white">
                <DiscIcon />
              </span>
              <div>
                <p className="font-heading text-lg font-bold text-slate-800">Home Video Saver</p>
                <p className="text-xs font-semibold text-slate-500">DVD → MP4</p>
              </div>
            </div>
            <div className="mt-5 space-y-4 text-sm">
              <div>
                <p className="mb-1.5 font-bold text-slate-600">DVD or VIDEO_TS folder</p>
                <div className="flex gap-2">
                  <div className="min-h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-500">
                    D:\VIDEO_TS
                  </div>
                  <span className="grid min-h-10 place-items-center rounded-lg bg-slate-200 px-3 font-bold text-slate-600">
                    Browse…
                  </span>
                </div>
              </div>
              <div className="rounded-xl border-2 border-blue-500 bg-blue-50 px-4 py-3">
                <p className="font-bold text-blue-900">Recording 1</p>
                <p className="mt-0.5 text-blue-700">1:24:18 · Ready to convert</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-[72%] rounded-full bg-blue-600" />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Converting… 72%</span>
                <span className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white">Convert to MP4</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-20" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-center font-heading text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          From disc to cloud in three steps
        </h2>
        <div className="mt-9 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.number} className="neo p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-accent)] font-heading text-lg font-bold text-white">
                {step.number}
              </span>
              <h3 className="mt-5 font-heading text-xl font-bold text-[var(--color-ink)]">{step.title}</h3>
              <p className="mt-2 leading-7 text-[var(--color-ink-muted)]">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="neo-inset mt-14 p-6 sm:p-8" aria-labelledby="before-start">
        <div className="grid gap-7 md:grid-cols-2 md:gap-12">
          <div>
            <h2 id="before-start" className="font-heading text-2xl font-bold text-[var(--color-ink)]">
              Before you start
            </h2>
            <ul className="mt-4 space-y-3 text-[var(--color-ink-muted)]">
              <li className="flex gap-3"><span className="font-bold text-[var(--color-teal)]">✓</span> Use a computer with a DVD drive or a VIDEO_TS folder.</li>
              <li className="flex gap-3"><span className="font-bold text-[var(--color-teal)]">✓</span> Keep the original disc until every MP4 has been checked.</li>
              <li className="flex gap-3"><span className="font-bold text-[var(--color-teal)]">✓</span> Make sure the destination has enough free storage.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-700/25 bg-amber-100/55 p-5 text-amber-950">
            <h3 className="font-heading text-lg font-bold">Personal recordings only</h3>
            <p className="mt-2 leading-7">
              This app is for home videos you own and have permission to copy. It
              does not bypass copy protection or DRM on commercial DVDs.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
