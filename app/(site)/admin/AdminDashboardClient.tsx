"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ADMIN_PRIVATE_PAGES,
  searchableAdminPageText,
  type AdminNavPage,
} from "@/lib/admin/navPages";

type ContentHit = {
  href: string;
  label: string;
  kind: "post" | "recipe";
};

type Props = {
  posts: Array<{ slug: string; title: string }>;
  recipes: Array<{ slug: string; title: string }>;
  purchaseRequestCounts: { pending: number; total: number };
  /** null = full access; array = allowlist */
  allowedHrefs?: string[] | null;
  showManageUsers?: boolean;
  pendingUserCount?: number;
};

function matchesQuery(haystack: string, terms: string[]): boolean {
  return terms.every((term) => haystack.includes(term));
}

export default function AdminDashboardClient({
  posts,
  recipes,
  purchaseRequestCounts,
  allowedHrefs = null,
  showManageUsers = false,
  pendingUserCount = 0,
}: Props) {
  const [query, setQuery] = useState("");

  const terms = useMemo(
    () =>
      query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
    [query]
  );

  const visiblePages = useMemo(() => {
    const pages = ADMIN_PRIVATE_PAGES.filter((page) => {
      if (allowedHrefs == null) return true;
      return allowedHrefs.includes(page.href);
    });
    if (showManageUsers) {
      pages.unshift({
        href: "/admin/users",
        label:
          pendingUserCount > 0
            ? `Manage Users (${pendingUserCount} pending)`
            : "Manage Users",
        description: "Approve logins and choose which pages people can see",
        keywords: ["accounts", "access", "approve", "permissions"],
      });
    }
    return pages;
  }, [allowedHrefs, showManageUsers, pendingUserCount]);

  const filteredPages = useMemo(() => {
    if (terms.length === 0) return visiblePages;
    return visiblePages.filter((page) =>
      matchesQuery(searchableAdminPageText(page), terms)
    );
  }, [terms, visiblePages]);

  const contentHits = useMemo(() => {
    if (terms.length === 0) return [] as ContentHit[];
    const hits: ContentHit[] = [];
    for (const post of posts) {
      if (matchesQuery(post.title.toLowerCase(), terms)) {
        hits.push({
          href: `/blog/${post.slug}`,
          label: post.title,
          kind: "post",
        });
      }
    }
    for (const recipe of recipes) {
      if (matchesQuery(recipe.title.toLowerCase(), terms)) {
        hits.push({
          href: `/recipes/${recipe.slug}`,
          label: recipe.title,
          kind: "recipe",
        });
      }
    }
    return hits.slice(0, 12);
  }, [posts, recipes, terms]);

  const showTruckFund =
    terms.length === 0 ||
    matchesQuery(
      "truck fund ford maverick down payment savings loan estimate",
      terms
    );
  const showRequests =
    terms.length === 0 ||
    matchesQuery("purchase requests buy shopping pending review", terms);
  const showPostsSection =
    terms.length === 0 ||
    matchesQuery("blog posts writing", terms) ||
    posts.some((post) => matchesQuery(post.title.toLowerCase(), terms));
  const showRecipesSection =
    terms.length === 0 ||
    matchesQuery("recipes cooking food", terms) ||
    recipes.some((recipe) => matchesQuery(recipe.title.toLowerCase(), terms));
  const showPuppyBanner =
    terms.length === 0 ||
    matchesQuery("puppy ranch dogs game breed puppies", terms);

  const filteredPosts =
    terms.length === 0
      ? posts
      : posts.filter((post) => matchesQuery(post.title.toLowerCase(), terms));
  const filteredRecipes =
    terms.length === 0
      ? recipes
      : recipes.filter((recipe) =>
          matchesQuery(recipe.title.toLowerCase(), terms)
        );

  const noMatches =
    terms.length > 0 &&
    filteredPages.length === 0 &&
    contentHits.length === 0 &&
    !showTruckFund &&
    !showRequests &&
    !showPuppyBanner;

  return (
    <>
      <div className="neo mb-6 p-4 sm:p-5">
        <label
          htmlFor="admin-dashboard-search"
          className="block text-sm font-semibold text-[var(--color-ink-muted)]"
        >
          Search admin
        </label>
        <input
          id="admin-dashboard-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find manuals, garage, recipes, posts…"
          className="neo-input mt-2"
        />
        {terms.length > 0 ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {filteredPages.length + contentHits.length} match
            {filteredPages.length + contentHits.length === 1 ? "" : "es"}
            {query.trim() ? ` for “${query.trim()}”` : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Jump to any admin tool, or filter posts and recipes by title.
          </p>
        )}

        {terms.length > 0 && (filteredPages.length > 0 || contentHits.length > 0) ? (
          <div className="mt-4 space-y-2">
            {filteredPages.slice(0, 8).map((page) => (
              <QuickResult key={page.href} page={page} />
            ))}
            {contentHits.map((hit) => (
              <Link
                key={`${hit.kind}-${hit.href}`}
                href={hit.href}
                className="neo-sm flex items-center justify-between gap-3 px-3 py-2.5 transition-[box-shadow] hover:shadow-[var(--neo-shadow-out)]"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-[var(--color-ink)]">
                  {hit.label}
                </span>
                <span className="neo-chip !min-h-7 !py-0.5 !text-[0.65rem] uppercase tracking-wide">
                  {hit.kind}
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-6 sm:space-y-8">
        {showPuppyBanner ? (
          <section className="neo p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                  Game
                </p>
                <h2 className="mt-1 font-heading text-2xl font-semibold text-[var(--color-ink)]">
                  Puppy Ranch
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  Buy starter dogs, breed puppies, and sell them for coins based on cuteness.
                </p>
              </div>
              <Link href="/admin/dogs" className="neo-btn-primary min-h-12">
                Play Puppy Ranch
              </Link>
            </div>
          </section>
        ) : null}

        <section className="neo p-4 sm:p-6">
          <div>
            <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
              Private pages
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Admin-only tools and hidden pages.
            </p>
          </div>
          {filteredPages.length === 0 ? (
            <p className="neo-inset mt-4 px-4 py-6 text-center text-sm text-[var(--color-muted)]">
              No pages match that search.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPages.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="neo-sm card-hover block px-4 py-3"
                >
                  <span className="block text-sm font-semibold text-[var(--color-ink)]">
                    {page.label}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--color-muted)]">
                    {page.description}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {showTruckFund ? (
          <section className="neo p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                Truck Fund
              </h2>
              <Link href="/admin/truck-fund" className="neo-link text-sm">
                Open →
              </Link>
            </div>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Ford Maverick down payment savings, loan estimate, and truck photo.
            </p>
          </section>
        ) : null}

        {showRequests ? (
          <section className="neo p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                  Purchase Requests
                </h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {purchaseRequestCounts.pending} pending · {purchaseRequestCounts.total} total
                </p>
              </div>
              <Link href="/admin/requests" className="neo-link text-sm">
                Review →
              </Link>
            </div>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Accept or reject things we want to buy, with reasons.
            </p>
          </section>
        ) : null}

        {showPostsSection ? (
          <section className="neo p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                Blog posts
              </h2>
              <Link href="/admin/posts/new" className="neo-link text-sm">
                + Add post
              </Link>
            </div>
            <ul className="mt-4 space-y-2">
              {filteredPosts.length === 0 ? (
                <li className="text-sm text-[var(--color-muted)]">
                  {terms.length > 0 ? "No posts match that search." : "No posts yet."}
                </li>
              ) : (
                filteredPosts.map((post) => (
                  <li
                    key={post.slug}
                    className="neo-sm flex items-start justify-between gap-4 px-3 py-2.5"
                  >
                    <Link
                      href={`/blog/${post.slug}`}
                      className="min-w-0 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                    >
                      {post.title}
                    </Link>
                    <Link
                      href={`/admin/posts/${post.slug}/edit`}
                      className="neo-link shrink-0 text-sm"
                    >
                      Edit
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {showRecipesSection ? (
          <section className="neo p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-semibold text-[var(--color-ink)]">
                  Recipes
                </h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {recipes.length} recipes on the site
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/admin/recipes" className="neo-link text-sm">
                  Manage →
                </Link>
                <Link href="/admin/recipes/new" className="neo-link text-sm">
                  + Add
                </Link>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {filteredRecipes.length === 0 ? (
                <li className="text-sm text-[var(--color-muted)]">
                  {terms.length > 0 ? "No recipes match that search." : "No recipes yet."}
                </li>
              ) : (
                filteredRecipes.map((recipe) => (
                  <li
                    key={recipe.slug}
                    className="neo-sm flex items-start justify-between gap-4 px-3 py-2.5"
                  >
                    <Link
                      href={`/recipes/${recipe.slug}`}
                      className="min-w-0 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                    >
                      {recipe.title}
                    </Link>
                    <Link
                      href={`/admin/recipes/${recipe.slug}/edit`}
                      className="neo-link shrink-0 text-sm"
                    >
                      Edit
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}

        {noMatches ? (
          <p className="neo-inset px-4 py-8 text-center text-sm text-[var(--color-muted)]">
            Nothing matched “{query.trim()}”. Try another word, or clear the search.
          </p>
        ) : null}
      </div>
    </>
  );
}

function QuickResult({ page }: { page: AdminNavPage }) {
  return (
    <Link
      href={page.href}
      className="neo-sm flex items-start justify-between gap-3 px-3 py-2.5 transition-[box-shadow] hover:shadow-[var(--neo-shadow-out)]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--color-ink)]">{page.label}</span>
        <span className="mt-0.5 block text-xs text-[var(--color-muted)]">{page.description}</span>
      </span>
      <span className="neo-chip !min-h-7 !py-0.5 !text-[0.65rem] uppercase tracking-wide">
        Page
      </span>
    </Link>
  );
}
