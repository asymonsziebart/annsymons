import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createMovieStreamToken,
  getDriveMovies,
  isDriveFileId,
} from "@/lib/googleDriveMovies";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Movie Player | Admin",
  robots: "noindex, nofollow",
};

export default async function AdminMoviePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isDriveFileId(id)) notFound();

  const movies = await getDriveMovies();
  const movie = movies.find((item) => item.id === id);
  if (!movie) notFound();

  const streamExpiresAt = Date.now() + 1000 * 60 * 60 * 12;
  const streamToken = createMovieStreamToken(id, streamExpiresAt);
  const streamUrl = `/api/admin/movies/${id}/stream?expires=${streamExpiresAt}&token=${streamToken}`;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href="/admin/movies"
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          ← Back to Movies
        </Link>
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          Admin
        </Link>
      </div>

      <header className="mb-6 mt-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Now playing
        </p>
        <h1 className="font-heading mt-3 text-2xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          {movie.name}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)] sm:text-base">
          This uses a standard video player instead of the Google Drive player,
          which should work better on devices with limited browser support.
        </p>
      </header>

      <section className="overflow-hidden rounded-3xl bg-black shadow-[0_24px_60px_-36px_rgba(28,25,23,0.65)] ring-1 ring-[var(--color-border)]">
        <video
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black"
        >
          <source src={streamUrl} type="video/mp4" />
          <a href={streamUrl}>Open the movie stream</a>
        </video>
      </section>

      <div className="mt-4 rounded-2xl bg-[var(--color-surface)] p-4 text-sm leading-relaxed text-[var(--color-ink-muted)] ring-1 ring-[var(--color-border)]">
        <p>
          If playback does not start right away on the Switch, use the direct
          stream button below. It opens the same private MP4 stream without any
          Google Drive page.
        </p>
        <a
          href={streamUrl}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          Open direct movie stream
        </a>
      </div>
    </div>
  );
}
