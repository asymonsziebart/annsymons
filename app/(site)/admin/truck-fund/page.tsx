import { getTruckFundSettings } from "@/lib/data/truckFund";
import TruckFundForm from "./TruckFundForm";

export const metadata = {
  title: "Truck Fund | Admin | Ann Symons",
  robots: "noindex, nofollow",
};

export default async function TruckFundPage() {
  const settings = await getTruckFundSettings();

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-5">
      <TruckFundForm {...settings} />
    </div>
  );
}
