import db from "../db.js";

export type EmissionFactorMapping = {
  id: string;

  // Actual DB columns used by the current query
  pattern: string;
  category: string | null;
  material: string | null;
  country: string | null;
  region: string | null;
  unit_type: string | null;
  calculation_basis: string | null;
  fallback_factor_kgco2e_per_unit: string | number | null;
  fallback_unit: string | null;
  priority: number | null;
  notes: string | null;

  // Optional DB columns: these may or may not exist in your Supabase table
  climatiq_activity_id?: string | null;
  climatiq_region?: string | null;
  climatiq_year?: number | null;

  // Compatibility fields used by src/app.ts
  activity_id: string | null;
  requested_region: string | null;
  parameter_name: string | null;
  data_version: string;
};

function mapUnitTypeToParameterName(unitType?: string | null): string | null {
  const value = String(unitType || "").toLowerCase().trim();

  if (["energy", "electricity", "kwh", "kw h"].includes(value)) {
    return "energy";
  }

  if (["mass", "weight", "kg", "kgs", "tonne", "tonnes", "ton", "mt"].includes(value)) {
    return "weight";
  }

  if (["volume", "litre", "liter", "litres", "liters", "l", "m3", "cubic_meter", "cubic metre"].includes(value)) {
    return "volume";
  }

  if (["distance", "km", "kilometre", "kilometer"].includes(value)) {
    return "distance";
  }

  return value || null;
}

function normalizeCountry(country?: string | null): string {
  return String(country || "Malaysia").trim() || "Malaysia";
}

function buildManualActivityId(row: any): string | null {
  const material = String(row?.material || "").toLowerCase().trim();
  const category = String(row?.category || "").toLowerCase().trim();

  if (material.includes("electricity") || category.includes("electricity")) {
    return "manual-malaysia-electricity";
  }

  if (material.includes("diesel")) {
    return "manual-malaysia-diesel";
  }

  if (material.includes("petrol") || material.includes("gasoline")) {
    return "manual-malaysia-petrol";
  }

  if (material.includes("natural")) {
    return "manual-malaysia-natural-gas";
  }

  if (material.includes("lpg")) {
    return "manual-malaysia-lpg";
  }

  return null;
}

export async function findBestMapping(
  itemName: string,
  country: string = "Malaysia",
  region?: string
): Promise<EmissionFactorMapping | null> {
  const cleanItemName = String(itemName || "").trim();
  const cleanCountry = normalizeCountry(country);
  const cleanRegion = region ? String(region).trim() : null;

  if (!cleanItemName) {
    return null;
  }

  /*
    IMPORTANT:
    Do not reference ef.climatiq_activity_id, ef.climatiq_region, ef.climatiq_year,
    or ef.active directly here because your current Supabase table may not have
    those columns. SELECT ef.* is safe, but selecting a missing column by name
    causes 500 errors like:
    column ef.climatiq_activity_id does not exist
  */
  const result = await db.query(
    `
    SELECT
      ef.*
    FROM public.emission_factor_mappings ef
    WHERE ef.country = $1
      AND $2 ~* ef.pattern
      AND (
        $3::text IS NULL
        OR ef.region = $3
        OR ef.region = 'Malaysia'
        OR ef.region IS NULL
      )
    ORDER BY
      CASE
        WHEN ef.region = $3 THEN 1
        WHEN ef.region = 'Malaysia' THEN 2
        WHEN ef.region IS NULL THEN 3
        ELSE 4
      END,
      ef.priority DESC NULLS LAST
    LIMIT 1;
    `,
    [cleanCountry, cleanItemName, cleanRegion]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const requestedRegion =
    row.climatiq_region ||
    row.region ||
    cleanRegion ||
    (cleanCountry.toLowerCase() === "malaysia" ? "MY" : cleanCountry);

  return {
    ...row,

    // These fields are required by src/app.ts, so we create them safely here.
    activity_id: row.climatiq_activity_id || buildManualActivityId(row),
    requested_region: requestedRegion,
    parameter_name: mapUnitTypeToParameterName(row.unit_type),

    // Required by old Climatiq body logic.
    data_version: row.data_version || "^6",
  };
}

export function calculateEmission(
  quantity: number,
  mapping: EmissionFactorMapping
) {
  const factor = Number(mapping.fallback_factor_kgco2e_per_unit || 0);
  const safeQuantity = Number(quantity || 0);

  const totalKgCO2e = safeQuantity * factor;
  const totalTCO2e = totalKgCO2e / 1000;

  return {
    emission_factor: factor,
    factor_unit: mapping.fallback_unit,
    total_kgco2e: Number(totalKgCO2e.toFixed(6)),
    total_tco2e: Number(totalTCO2e.toFixed(6)),
    material: mapping.material,
    category: mapping.category,
    region: mapping.region,
    source: mapping.notes,
  };
}
