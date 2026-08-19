"use client";

import Link from "next/link";

export default function PokemonCardsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="pc-shell">
      <Link href="/admin" className="pc-back">
        ← Admin
      </Link>
      <div className="pc-panel" style={{ marginTop: "1rem" }}>
        <div className="pc-panel-body">
          <h2 className="pc-collection-title">Could not load Pokemon Cards</h2>
          <p className="pc-status" data-tone="warn" style={{ marginTop: "0.75rem" }}>
            {error.message || "Something went wrong while loading this page."}
          </p>
          <div className="pc-actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="pc-btn pc-btn-primary" onClick={() => reset()}>
              Try again
            </button>
            <Link href="/admin/pokemon-cards" className="pc-btn">
              Reload page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
