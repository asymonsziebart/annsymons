import Link from "next/link";
import { getBackyardData } from "@/lib/data/backyard";
import { getSql } from "@/lib/db";
import BackyardApp from "./BackyardApp";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Backyard Plants | Admin",
  robots: "noindex, nofollow",
};

export default async function BackyardPlantsPage() {
  const { photos, pins } = await getBackyardData();
  const dbReady = getSql() !== null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-12">
      <Link href="/admin" className="neo-link inline-flex min-h-11 items-center text-sm">
        ← Back to Admin
      </Link>

      <header className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Admin tool
        </p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-5xl">
          Backyard Plants
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-[var(--color-ink-muted)] sm:text-base">
          Upload a photo of your backyard, drop pins where you planted things, and search the
          catalog whenever you forget what went where.
        </p>
      </header>

      {!dbReady && (
        <p className="neo-inset mt-6 px-4 py-3 text-sm text-[var(--color-ink-muted)]">
          DATABASE_URL is not set — photos and pins will not persist. Add your Neon connection
          string in Vercel (or .env locally), then redeploy.
        </p>
      )}

      <BackyardApp
        initialPhotos={photos}
        initialPins={pins}
        useClientBlobUpload={!!process.env.BLOB_READ_WRITE_TOKEN}
      />
    </div>
  );
}
