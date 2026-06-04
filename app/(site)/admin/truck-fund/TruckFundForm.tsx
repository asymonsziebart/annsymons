"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TruckFundSettings } from "@/lib/data/truckFund";
import { loanPrincipal, monthlyLoanPayment } from "@/lib/truckLoan";
import ImageUploadField from "../ImageUploadField";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const currencyCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type Props = TruckFundSettings;

export default function TruckFundForm(initial: Props) {
  const [downPaymentSaved, setDownPaymentSaved] = useState(String(initial.downPaymentSaved));
  const [interestRatePercent, setInterestRatePercent] = useState(
    String(initial.interestRatePercent)
  );
  const [vehiclePrice, setVehiclePrice] = useState(String(initial.vehiclePrice));
  const [imagePath, setImagePath] = useState(initial.imagePath);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const down = parseFloat(downPaymentSaved) || 0;
  const rate = parseFloat(interestRatePercent) || 0;
  const price = parseFloat(vehiclePrice) || 0;
  const termMonths = initial.loanTermMonths;

  const { principal, monthlyPayment, amountFinancedLabel } = useMemo(() => {
    const principalAmount = loanPrincipal(price, down);
    const payment = monthlyLoanPayment(principalAmount, rate, termMonths);
    return {
      principal: principalAmount,
      monthlyPayment: payment,
      amountFinancedLabel: currency.format(principalAmount),
    };
  }, [down, rate, price, termMonths]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/truck-fund", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          downPaymentSaved: down,
          interestRatePercent: rate,
          vehiclePrice: price,
          loanTermMonths: termMonths,
          imagePath,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {imagePath && (
        <div className="overflow-hidden rounded-2xl ring-1 ring-[var(--color-border)]">
          <img
            src={imagePath}
            alt="Ford Maverick"
            className="max-h-64 w-full object-cover"
          />
        </div>
      )}

      <ImageUploadField
        folder="truck-fund"
        value={imagePath}
        onChange={setImagePath}
        label="Truck photo"
        inputClass={inputClass}
      />

      <div className="rounded-2xl bg-[var(--color-surface)] p-6 ring-1 ring-[var(--color-border)]">
        <p className="text-sm font-medium text-[var(--color-ink-muted)]">Vehicle</p>
        <p className="mt-1 font-heading text-xl font-semibold text-[var(--color-ink)]">
          Ford Maverick
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {termMonths / 12}-year loan · payment updates as you change the down payment
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
          Maverick price (MSRP / target)
        </label>
        <input
          type="number"
          min={0}
          step={100}
          value={vehiclePrice}
          onChange={(e) => setVehiclePrice(e.target.value)}
          className={inputClass}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
          Down payment saved
        </label>
        <input
          type="number"
          min={0}
          step={50}
          value={downPaymentSaved}
          onChange={(e) => setDownPaymentSaved(e.target.value)}
          className={inputClass}
          required
        />
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {down >= price && price > 0
            ? "Saved amount covers the full price — no loan needed."
            : `Financing ${amountFinancedLabel} after down payment.`}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-muted)]">
          Expected interest rate (% APR)
        </label>
        <input
          type="number"
          min={0}
          max={30}
          step={0.1}
          value={interestRatePercent}
          onChange={(e) => setInterestRatePercent(e.target.value)}
          className={inputClass}
          required
        />
      </div>

      <div className="rounded-2xl bg-[var(--color-accent)]/10 p-6 ring-1 ring-[var(--color-accent)]/30">
        <p className="text-sm font-medium text-[var(--color-ink-muted)]">
          Estimated monthly payment
        </p>
        <p className="mt-2 font-heading text-3xl font-semibold text-[var(--color-ink)]">
          {principal <= 0 ? currency.format(0) : currencyCents.format(monthlyPayment)}
          <span className="text-lg font-normal text-[var(--color-muted)]"> / month</span>
        </p>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          At {rate}% over {termMonths} months on {amountFinancedLabel}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-green-700">Saved.</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save"}
        </button>
        <Link
          href="/admin"
          className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-cream)]"
        >
          Back to admin
        </Link>
      </div>
    </form>
  );
}
