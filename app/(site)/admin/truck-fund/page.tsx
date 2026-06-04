import { getSql } from "@/lib/db";
import { getTruckFundSettings } from "@/lib/data/truckFund";
import TruckFundForm from "./TruckFundForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Truck Fund | Admin | Ann Symons",
  robots: "noindex, nofollow",
};

export default async function TruckFundPage() {
  const settings = await getTruckFundSettings();
  const dbReady = getSql() !== null;

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-5">
      {!dbReady && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          DATABASE_URL is not set — numbers will not persist. Add your Neon connection string in
          Vercel (or .env locally), then redeploy.
        </p>
      )}
      <TruckFundForm {...settings} dbReady={dbReady} />
    </div>
  );
}
