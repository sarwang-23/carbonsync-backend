import db from "../db.js";

export type EmissionFactorMapping = {
  id: string;
  pattern: string;
  category: string;
  material: string;
  country: string;
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
};

export async function findBestMapping(
  itemName: string,
  country: string = "Malaysia",
  region?: string
): Promise<EmissionFactorMapping | null> {
  const cleanItemName = itemName || "";

  const result = await db.query(
    `
    SELECT *
    FROM public.emission_factor_mappings
    WHERE country = $1
      AND $2 ~* pattern
      AND (
        $3::text IS NULL
        OR region = $3
        OR region = 'Malaysia'
        OR region IS NULL
      )
    ORDER BY
      CASE
        WHEN region = $3 THEN 1
        WHEN region = 'Malaysia' THEN 2
        WHEN region IS NULL THEN 3
        ELSE 4
      END,
      priority DESC NULLS LAST
    LIMIT 1;
    `,
    [country, cleanItemName, region || null]
  );

  return result.rows[0] || null;
}

export function calculateEmission(
  quantity: number,
  mapping: EmissionFactorMapping
) {
  const factor = Number(mapping.fallback_factor_kgco2e_per_unit || 0);

  const totalKgCO2e = quantity * factor;
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
