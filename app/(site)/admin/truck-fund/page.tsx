import type { Metadata } from "next";
import { getSql } from "@/lib/db";
import { getTruckFundSettings } from "@/lib/data/truckFund";
import TruckFundForm from "./TruckFundForm";

export const dynamic = "force-dynamic";

const TRUCK_OG_IMAGE = "/truck-fund/fordmaverickphoto.png";

export const metadata: Metadata = {
  title: "Truck Fund · Ford Maverick",
  description: "Track savings toward a Ford Maverick and estimated 5-year loan payment.",
  openGraph: {
    title: "Truck Fund · Ford Maverick",
    description: "Track savings toward a Ford Maverick and estimated 5-year loan payment.",
    type: "website",
    images: [
      {
        url: TRUCK_OG_IMAGE,
        alt: "Ford Maverick",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Truck Fund · Ford Maverick",
    description: "Track savings toward a Ford Maverick and estimated 5-year loan payment.",
    images: [TRUCK_OG_IMAGE],
  },
  robots: "noindex, nofollow",
};

export default async function TruckFundPage() {
  const settings = await getTruckFundSettings();
  const dbReady = getSql() !== null;

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-5">
      {!dbReady && (
        <p className="neo-inset mb-3 px-4 py-3 text-sm text-[var(--color-ink-muted)]">
          DATABASE_URL is not set — numbers will not persist. Add your Neon connection string in
          Vercel (or .env locally), then redeploy.
        </p>
      )}
      <TruckFundForm {...settings} dbReady={dbReady} />
    </div>
  );
}
