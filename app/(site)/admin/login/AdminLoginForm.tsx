"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginForm({ nextPath = "/admin" }: { nextPath?: string }) {
  const [mode, setMode] = useState<"password" | "account">("password");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
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
        body: JSON.stringify(
          mode === "account" ? { email, password } : { password }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid login");
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
      <div className="mb-4 flex gap-2 text-sm">
        <button
          type="button"
          className={`rounded-xl px-3 py-1.5 ${
            mode === "password"
              ? "font-semibold text-[var(--color-accent)] shadow-[var(--neo-shadow-in-sm)]"
              : "text-[var(--color-muted)]"
          }`}
          onClick={() => setMode("password")}
        >
          Admin password
        </button>
        <button
          type="button"
          className={`rounded-xl px-3 py-1.5 ${
            mode === "account"
              ? "font-semibold text-[var(--color-accent)] shadow-[var(--neo-shadow-in-sm)]"
              : "text-[var(--color-muted)]"
          }`}
          onClick={() => setMode("account")}
        >
          Email login
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "account" ? (
          <div>
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="neo-input"
              autoComplete="username"
              required
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="neo-input"
            autoComplete={mode === "account" ? "current-password" : "current-password"}
            required
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="neo-btn-primary w-full disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
        Need access?{" "}
        <Link href="/request-access" className="neo-link text-xs">
          Request a login
        </Link>
      </p>
    </div>
  );
}
