"use client";

import { useState } from "react";

type SubmitState = "idle" | "submitting" | "submitted" | "error";

export default function PurchaseRequestForm() {
  const [itemName, setItemName] = useState("");
  const [details, setDetails] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    try {
      const res = await fetch("/api/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName, details, requestedBy }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Could not submit request.");
        return;
      }
      setItemName("");
      setDetails("");
      setRequestedBy("");
      setState("submitted");
      setMessage("Request sent for review.");
    } catch {
      setState("error");
      setMessage("Something went wrong. Try again.");
    }
  }

  const inputClass =
    "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-base text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="purchase-item" className="mb-1 block text-sm font-semibold text-stone-800">
          What do you want to buy?
        </label>
        <input
          id="purchase-item"
          value={itemName}
          onChange={(event) => setItemName(event.target.value)}
          className={inputClass}
          placeholder="AirTag for Copper's collar"
          maxLength={160}
          required
        />
      </div>

      <div>
        <label htmlFor="purchase-details" className="mb-1 block text-sm font-semibold text-stone-800">
          Notes or reason
        </label>
        <textarea
          id="purchase-details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          className={inputClass}
          placeholder="Why we need it, links, price, or anything else to review."
          rows={5}
          maxLength={2000}
        />
      </div>

      <div>
        <label htmlFor="purchase-requested-by" className="mb-1 block text-sm font-semibold text-stone-800">
          Requested by
        </label>
        <input
          id="purchase-requested-by"
          value={requestedBy}
          onChange={(event) => setRequestedBy(event.target.value)}
          className={inputClass}
          placeholder="Ann"
          maxLength={80}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "submitting" ? "Sending..." : "Submit request"}
        </button>
        {message ? (
          <p
            className={`text-sm font-medium ${
              state === "error" ? "text-red-700" : "text-emerald-700"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
