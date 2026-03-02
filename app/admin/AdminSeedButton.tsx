"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminSeedButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSeed() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Seed failed");
        return;
      }
      setMessage("Content seeded. Refresh to see changes.");
      router.refresh();
    } catch {
      setMessage("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSeed}
        disabled={loading}
        className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)] disabled:opacity-50"
      >
        {loading ? "Seeding…" : "Seed from site content"}
      </button>
      {message && (
        <span className="text-sm text-[var(--color-muted)]">{message}</span>
      )}
    </div>
  );
}
