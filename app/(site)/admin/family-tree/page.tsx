import Link from "next/link";
import { getSql } from "@/lib/db";
import { getFamilyTree, getSeedFamilyTree } from "@/lib/data/familyTree";
import FamilyTreeApp from "./FamilyTreeApp";

export const metadata = {
  title: "Family Tree | Admin",
  robots: "noindex, nofollow",
};

export default async function FamilyTreeAdminPage() {
  const dbReady = Boolean(getSql());
  const tree = dbReady ? await getFamilyTree() : await getSeedFamilyTree();

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
          Family Tree
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-[var(--color-ink-muted)] sm:text-base">
          Private genealogy canvas from your Quick Family Tree export. Tap someone to center their
          branch, zoom, and switch child / grandchild depth. Only admin sessions can open this page.
        </p>
      </header>

      <FamilyTreeApp initialTree={tree} dbReady={dbReady} />
    </div>
  );
}
