"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TruckFundSettings } from "@/lib/data/truckFund";
import { loanPrincipal, monthlyLoanPayment } from "@/lib/truckLoan";

const TRUCK_IMAGE = "/truck-fund/fordmaverickphoto.jpg";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const heroImage = initial.imagePath || TRUCK_IMAGE;
  const down = parseFloat(downPaymentSaved) || 0;
  const rate = parseFloat(interestRatePercent) || 0;
  const price = parseFloat(vehiclePrice) || 0;
  const termMonths = initial.loanTermMonths;
  const termYears = termMonths / 12;

  const { principal, monthlyPayment, amountFinancedLabel } = useMemo(() => {
    const principalAmount = loanPrincipal(price, down);
    const payment = monthlyLoanPayment(principalAmount, rate, termMonths);
    return {
      principal: principalAmount,
      monthlyPayment: payment,
      amountFinancedLabel: currency.format(principalAmount),
    };
  }, [down, rate, price, termMonths]);

  const monthlyLabel =
    principal <= 0 ? currency.format(0) : currencyCents.format(monthlyPayment);

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
          imagePath: heroImage,
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
    "w-full rounded-lg border border-white/25 bg-white/15 px-3 py-2 text-sm text-white placeholder:text-white/50 backdrop-blur-sm focus:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/40";

  return (
    <form onSubmit={handleSubmit} className="min-h-[calc(100dvh-4rem)]">
      <section
        className="relative flex min-h-[calc(100dvh-4rem)] flex-col overflow-hidden rounded-2xl ring-1 ring-black/10"
        aria-label="Truck Fund"
      >
        <div
          className="absolute inset-0 bg-cover bg-[center_35%] bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
          role="img"
          aria-label="Ford Maverick"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/30" />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/admin"
              className="text-sm font-medium text-white/80 hover:text-white"
            >
              ← Admin
            </Link>
            {(saved || error) && (
              <p
                className={`text-xs font-medium ${error ? "text-red-300" : "text-emerald-300"}`}
              >
                {error || "Saved"}
              </p>
            )}
          </div>

          <div className="mt-2 flex flex-1 flex-col justify-end pb-1">
            <p className="text-xs font-medium uppercase tracking-wide text-white/70">
              Truck Fund · Ford Maverick
            </p>
            <p className="mt-1 font-heading text-4xl font-semibold leading-none text-white sm:text-5xl">
              {monthlyLabel}
              <span className="text-lg font-normal text-white/70 sm:text-xl"> / mo</span>
            </p>
            <p className="mt-2 text-sm text-white/75">
              {down >= price && price > 0 ? (
                "Down payment covers full price — no loan"
              ) : (
                <>
                  {amountFinancedLabel} financed · {rate}% APR · {termYears}-year loan
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-white/55">
              {currency.format(down)} saved toward {currency.format(price)}
            </p>
          </div>

          <div className="mt-4 grid shrink-0 grid-cols-1 gap-3 rounded-xl border border-white/15 bg-black/35 p-3 backdrop-blur-md sm:grid-cols-3 sm:gap-2 sm:p-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">
                Price
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
              <label className="mb-1 block text-xs font-medium text-white/70">
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
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/70">
                Interest %
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
          </div>

          <div className="mt-3 flex shrink-0 gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
