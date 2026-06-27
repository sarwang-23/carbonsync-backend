import db from "../db.js";

export type EmissionFactorMapping = {
  id: string;

  // Actual DB columns in public.emission_factor_mappings
  pattern: string;
  category: string | null;
  material: string | null;
  country: string | null;
  region: string | null;
  climatiq_activity_id: string | null;
  climatiq_region: string | null;
  climatiq_year: number | null;
  unit_type: string | null;
  calculation_basis: string | null;
  fallback_factor_kgco2e_per_unit: string | number | null;
  fallback_unit: string | null;
  priority: number | null;
  notes: string | null;

  // Compatibility fields used in src/app.ts
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

  const result = await db.query(
    `
    SELECT
      ef.*,

      -- Old app.ts compatibility aliases
      ef.climatiq_activity_id AS activity_id,
      COALESCE(ef.climatiq_region, ef.region) AS requested_region,
      '^6'::text AS data_version

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

  return {
    ...row,

    // These 3 fields are required by src/app.ts at multiple lines.
    activity_id: row.activity_id || row.climatiq_activity_id || null,
    requested_region: row.requested_region || row.climatiq_region || row.region || null,
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
