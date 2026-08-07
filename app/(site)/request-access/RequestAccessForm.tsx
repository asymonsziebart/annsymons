"use client";

import { useState } from "react";
import Link from "next/link";

export default function RequestAccessForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/account/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not submit request");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--color-ink)]">
        <p>
          Request submitted. You’ll be able to sign in at{" "}
          <Link href="/admin/login" className="neo-link">
            /admin/login
          </Link>{" "}
          after Ann approves your account and assigns pages.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm text-[var(--color-muted)]">
          Name
        </label>
        <input
          id="name"
          className="neo-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-[var(--color-muted)]">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="neo-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
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
          className="neo-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="mt-1 text-xs text-[var(--color-muted)]">At least 8 characters.</p>
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
        {loading ? "Submitting…" : "Request access"}
      </button>
      <p className="text-center text-xs text-[var(--color-muted)]">
        Already approved?{" "}
        <Link href="/admin/login" className="neo-link text-xs">
          Sign in
        </Link>
      </p>
    </form>
  );
}
