import { getSql, getSqlOrThrow } from "@/lib/db";

export type TruckFundSettings = {
  downPaymentSaved: number;
  interestRatePercent: number;
  vehiclePrice: number;
  loanTermMonths: number;
  imagePath: string;
};

const DEFAULTS: TruckFundSettings = {
  downPaymentSaved: 0,
  interestRatePercent: 5,
  vehiclePrice: 28000,
  loanTermMonths: 60,
  imagePath: "/truck-fund/fordmaverickphoto.png",
};

function rowToSettings(row: Record<string, unknown>): TruckFundSettings {
  return {
    downPaymentSaved: Number(row.down_payment_saved ?? 0),
    interestRatePercent: Number(row.interest_rate_percent ?? 5),
    vehiclePrice: Number(row.vehicle_price ?? 28000),
    loanTermMonths: Number(row.loan_term_months ?? 60),
    imagePath:
      typeof row.image_path === "string" && row.image_path
        ? row.image_path
        : DEFAULTS.imagePath,
  };
}

export async function getTruckFundSettings(): Promise<TruckFundSettings> {
  const sql = getSql();
  if (!sql) return { ...DEFAULTS };
  try {
    const rows = await sql`
      SELECT down_payment_saved, interest_rate_percent, vehicle_price, loan_term_months, image_path
      FROM truck_fund
      WHERE id = 1
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row && typeof row === "object") return rowToSettings(row as Record<string, unknown>);
  } catch {
    // table may not exist yet
  }
  return { ...DEFAULTS };
}

export async function upsertTruckFundSettings(
  settings: TruckFundSettings
): Promise<void> {
  const sql = getSqlOrThrow();
  await sql`
    INSERT INTO truck_fund (
      id,
      down_payment_saved,
      interest_rate_percent,
      vehicle_price,
      loan_term_months,
      image_path,
      updated_at
    )
    VALUES (
      1,
      ${settings.downPaymentSaved},
      ${settings.interestRatePercent},
      ${settings.vehiclePrice},
      ${settings.loanTermMonths},
      ${settings.imagePath || null},
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      down_payment_saved = EXCLUDED.down_payment_saved,
      interest_rate_percent = EXCLUDED.interest_rate_percent,
      vehicle_price = EXCLUDED.vehicle_price,
      loan_term_months = EXCLUDED.loan_term_months,
      image_path = EXCLUDED.image_path,
      updated_at = NOW()
  `;
}
