import Link from "next/link";
import { getAllPosts } from "@/lib/data/posts";
import { getAllRecipes } from "@/lib/data/recipes";
import { getPurchaseRequestCounts } from "@/lib/data/purchaseRequests";
import { countPendingSiteUsers } from "@/lib/data/siteUsers";
import {
  getVisibleAdminHrefs,
  isOwner,
  isSharedAdmin,
} from "@/lib/auth";
import AdminLogoutButton from "./AdminLogoutButton";
import AdminSeedButton from "./AdminSeedButton";
import AdminDashboardClient from "./AdminDashboardClient";

export const metadata = {
  title: "Admin | Ann Symons",
  robots: "noindex, nofollow",
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const sp = await searchParams;
  const owner = await isOwner();
  const sharedAdmin = await isSharedAdmin();
  const allowedHrefs = await getVisibleAdminHrefs();
  const can = (href: string) =>
    allowedHrefs == null ? true : allowedHrefs.includes(href);

  const [posts, recipes, purchaseRequestCounts, pendingUsers] =
    await Promise.all([
      can("/blog") || can("/admin/posts/new") ? getAllPosts() : Promise.resolve([]),
      can("/admin/recipes") ? getAllRecipes() : Promise.resolve([]),
      can("/admin/requests")
        ? getPurchaseRequestCounts()
        : Promise.resolve({ pending: 0, total: 0 }),
      owner ? countPendingSiteUsers() : Promise.resolve(0),
    ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-semibold text-[var(--color-ink)]">
          Admin
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          {can("/admin/recipes") ? (
            <Link href="/admin/recipes" className="neo-btn-primary !min-h-10 !px-4 !py-2">
              Recipes
            </Link>
          ) : null}
          {can("/admin/garage") ? (
            <Link href="/admin/garage" className="neo-btn !min-h-10 !px-4 !py-2">
              Garage
            </Link>
          ) : null}
          {can("/admin/manuals") ? (
            <Link href="/admin/manuals" className="neo-btn !min-h-10 !px-4 !py-2">
              Manuals
            </Link>
          ) : null}
          {can("/admin/family-tree") ? (
            <Link href="/admin/family-tree" className="neo-btn !min-h-10 !px-4 !py-2">
              Family Tree
            </Link>
          ) : null}
          {can("/admin/family-history") ? (
            <Link href="/admin/family-history" className="neo-btn !min-h-10 !px-4 !py-2">
              Family History
            </Link>
          ) : null}
          {owner ? (
            <Link href="/admin/users" className="neo-btn-primary !min-h-10 !px-4 !py-2">
              Users{pendingUsers > 0 ? ` (${pendingUsers})` : ""}
            </Link>
          ) : null}
          {can("/admin/dogs") ? (
            <Link href="/admin/dogs" className="neo-btn !min-h-10 !px-4 !py-2">
              Puppy Ranch
            </Link>
          ) : null}
          {can("/admin/voices") ? (
            <Link href="/admin/voices" className="neo-btn-primary !min-h-10 !px-4 !py-2">
              Voices
            </Link>
          ) : null}
          {can("/admin/requests") ? (
            <Link href="/admin/requests" className="neo-btn !min-h-10 !px-4 !py-2">
              Requests
            </Link>
          ) : null}
          {sharedAdmin || owner ? <AdminSeedButton /> : null}
          <AdminLogoutButton />
          <Link href="/" className="neo-link text-sm">
            View site →
          </Link>
        </div>
      </div>

      {sp.denied === "1" ? (
        <p className="neo-inset mb-6 px-4 py-3 text-sm text-[var(--color-ink)]" role="alert">
          You don’t have access to that page.
        </p>
      ) : null}

      <AdminDashboardClient
        posts={posts.map((post) => ({ slug: post.slug, title: post.title }))}
        recipes={recipes.map((recipe) => ({ slug: recipe.slug, title: recipe.title }))}
        purchaseRequestCounts={purchaseRequestCounts}
        allowedHrefs={allowedHrefs}
        showManageUsers={owner}
        pendingUserCount={pendingUsers}
      />
    </div>
  );
}
