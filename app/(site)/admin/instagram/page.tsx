import Link from "next/link";
import { getSql } from "@/lib/db";
import {
  getConnectedAccountPublic,
  listInstagramPosts,
} from "@/lib/data/instagram";
import { isInstagramConfigured } from "@/lib/instagram/config";
import InstagramAdminClient from "./InstagramAdminClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Instagram | Admin | Ann Symons",
  robots: "noindex, nofollow",
};

type SearchParams = Promise<{ error?: string; connected?: string }>;

export default async function InstagramAdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const [account, posts] = await Promise.all([
    getConnectedAccountPublic(),
    listInstagramPosts(),
  ]);

  const flashError =
    typeof params.error === "string" && params.error
      ? params.error === "not_configured"
        ? "Instagram app credentials are not configured."
        : params.error === "oauth_start_failed"
          ? "Could not start Instagram login."
          : params.error
      : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8 sm:py-12">
      <Link href="/admin" className="neo-link inline-flex min-h-11 items-center text-sm">
        ← Back to Admin
      </Link>
      <h1 className="mt-4 font-heading text-2xl font-semibold text-[var(--color-ink)]">
        Instagram
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
        Connect your account, queue photos with captions, and post when you’re ready.
      </p>

      <div className="mt-6">
        <InstagramAdminClient
          configured={isInstagramConfigured()}
          account={account}
          posts={posts}
          flashError={flashError}
          flashConnected={params.connected === "1"}
          dbReady={getSql() !== null}
        />
      </div>
    </div>
  );
}
