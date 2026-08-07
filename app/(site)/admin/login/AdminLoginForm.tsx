"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginForm({ nextPath = "/admin" }: { nextPath?: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid username or password");
        return;
      }
      const dest =
        typeof data.next === "string" && data.next.startsWith("/")
          ? data.next
          : nextPath;
      router.push(dest);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="username"
            className="mb-1 block text-sm text-[var(--color-muted)]"
          >
            Username
          </label>
          <input
            id="username"
            type="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Email"
            className="neo-input"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm text-[var(--color-muted)]"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="neo-input"
            autoComplete="current-password"
            required
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="neo-btn-primary w-full disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <Link
        href="/request-access"
        className="neo-btn mt-3 flex w-full items-center justify-center !min-h-11"
      >
        Create account
      </Link>
    </div>
  );
}
