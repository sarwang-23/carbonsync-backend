import db from "../db.js";

export async function findBestMapping(
  itemName: string,
  country: string = "Malaysia",
  region?: string
) {
  const cleanItem = String(itemName || "").toLowerCase().trim();

  const result = await db.query(
    `
    SELECT *
    FROM public.emission_factor_mappings
    WHERE active = true
      AND country = $1
      AND $2 ~* pattern
      AND (
        $3::text IS NULL
        OR region = $3
        OR region = 'Malaysia'
        OR region IS NULL
      )
    ORDER BY priority DESC NULLS LAST
    LIMIT 1;
    `,
    [country, cleanItem, region || null]
  );

  const row = result.rows[0];

  if (!row) return null;

  return {
    ...row,
    activity_id: row.climatiq_activity_id || null,
    requested_region: row.region || country,
    parameter_name:
      row.unit_type?.toLowerCase().includes("energy") ? "energy" : null,
    data_version: "^6",
  };
}

export function calculateEmission(quantity: number, mapping: any) {
  const factor = Number(mapping.fallback_factor_kgco2e_per_unit || 0);

  return {
    emission_factor: factor,
    total_kgco2e: quantity * factor,
    total_tco2e: (quantity * factor) / 1000,
    unit: mapping.fallback_unit,
  };
}