"use client";

import { useState } from "react";

export default function TasksLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitLogin();
  }

  async function submitLogin() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/tasks/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      let data: { error?: string } = {};
      const ct = res.headers.get("content-type");
      if (ct?.includes("application/json")) {
        try {
          data = (await res.json()) as { error?: string };
        } catch {
          /* non-JSON body */
        }
      }
      if (!res.ok) {
        setError(data.error || "Invalid password");
        return;
      }
      window.location.assign("/tasks");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="tasks-password" className="sr-only">
          Password
        </label>
        <input
          id="tasks-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="neo-input"
          autoComplete="current-password"
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
  );
}
