import Link from "next/link";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { isOwner } from "@/lib/auth";
import {
  listSiteUsers,
  SITE_USERS_MIGRATION_HINT,
} from "@/lib/data/siteUsers";
import ManageUsersClient from "./ManageUsersClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Manage Users | Admin",
  robots: "noindex, nofollow",
};

export default async function ManageUsersPage() {
  if (!(await isOwner())) {
    redirect("/admin?denied=1");
  }

  const dbReady = getSql() !== null;
  const users = await listSiteUsers();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-12">
      <Link href="/admin" className="neo-link inline-flex min-h-11 items-center text-sm">
        ← Back to Admin
      </Link>

      <header className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Owner only
        </p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-5xl">
          Manage Users
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-[var(--color-ink-muted)] sm:text-base">
          People can create an account from the admin login page or{" "}
          <Link href="/request-access" className="neo-link">
            /request-access
          </Link>
          . Approve them here and pick exactly which private pages they can open.
          Only your super admin login can open this page.
        </p>
      </header>

      <div className="mt-10">
        <ManageUsersClient
          initialUsers={users}
          dbReady={dbReady}
          migrationHint={SITE_USERS_MIGRATION_HINT}
        />
      </div>
    </main>
  );
}
