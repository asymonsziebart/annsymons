import Link from "next/link";
import { getTruckFundSettings } from "@/lib/data/truckFund";
import TruckFundForm from "./TruckFundForm";

export const metadata = {
  title: "Truck Fund | Admin | Ann Symons",
  robots: "noindex, nofollow",
};

export default async function TruckFundPage() {
  const settings = await getTruckFundSettings();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
      <Link
        href="/admin"
        className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        ← Admin
      </Link>
      <h1 className="mt-4 font-heading text-2xl font-semibold text-[var(--color-ink)]">
        Truck Fund
      </h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Track savings toward a Ford Maverick and see your estimated 5-year loan payment.
      </p>
      <TruckFundForm {...settings} />
    </div>
  );
}
