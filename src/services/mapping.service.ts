import db from "../db.js";

export type EmissionFactorMapping = {
  id: string;

  // Current DB columns used safely by the query
  pattern: string;
  category: string | null;
  material: string | null;
  region: string | null;
  unit_type: string | null;
  calculation_basis: string | null;
  fallback_factor_kgco2e_per_unit: string | number | null;
  fallback_unit: string | null;
  priority: number | null;
  notes: string | null;

  // These columns may not exist in your current Supabase table, so we do not query them directly
  country?: string | null;
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
  const cleanRegion = region ? String(region).trim() : null;

  if (!cleanItemName) {
    return null;
  }

  /*
    IMPORTANT:
    Your current Supabase table is missing these columns:
    - country
    - active
    - climatiq_activity_id

    So this query does NOT reference them directly.
    It only uses columns that are currently safe:
    pattern, region, priority, and ef.*
  */
  const result = await db.query(
    `
    SELECT
      ef.*
    FROM public.emission_factor_mappings ef
    WHERE $1 ~* ef.pattern
      AND (
        $2::text IS NULL
        OR ef.region = $2
        OR ef.region = 'Malaysia'
        OR ef.region IS NULL
      )
    ORDER BY
      CASE
        WHEN ef.region = $2 THEN 1
        WHEN ef.region = 'Malaysia' THEN 2
        WHEN ef.region IS NULL THEN 3
        ELSE 4
      END,
      ef.priority DESC NULLS LAST
    LIMIT 1;
    `,
    [cleanItemName, cleanRegion]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const requestedRegion =
    row.climatiq_region ||
    row.region ||
    cleanRegion ||
    (String(country || "").toLowerCase() === "malaysia" ? "MY" : country);

  return {
    ...row,

    // compatibility for src/app.ts
    country: row.country || country || "Malaysia",
    activity_id: row.climatiq_activity_id || buildManualActivityId(row),
    requested_region: requestedRegion,
    parameter_name: mapUnitTypeToParameterName(row.unit_type),
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

