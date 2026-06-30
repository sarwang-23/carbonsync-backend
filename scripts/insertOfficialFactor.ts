import { pool } from "../src/db.js";

function normalizeArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

function safeNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value)
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function buildKeywords(raw: any): string[] {
  const text = [
    raw.name,
    raw.category,
    raw.sector,
    raw.activity_id,
    raw.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return Array.from(
    new Set(
      text
        .split(/[^a-zA-Z0-9]+/)
        .map((x) => x.trim())
        .filter((x) => x.length > 2)
    )
  ).slice(0, 60);
}

export async function insertOfficialFactor(raw: any) {
  const factorId = raw.id || raw.factor_id;

  if (!factorId) {
    console.warn("Skipping factor without id:", raw.name);
    return;
  }

  const factor = safeNumber(raw.factor);

  const name = raw.name || "Unknown factor";
  const region = raw.region;

  if (!region) {
    console.warn("Skipping factor without region:", name);
    return;
  }

  await pool.query(
    `
    insert into official_emission_factors (
      factor_id,
      activity_id,
      use_case,
      name,
      sector,
      category,
      country_name,
      region,
      source,
      source_dataset,
      source_link,
      source_lca_activity,
      year,
      year_released,
      unit_type,
      unit,
      factor,
      factor_calculation_method,
      factor_calculation_origin,
      scopes,
      supported_calculation_methods,
      constituent_gases,
      additional_indicators,
      raw_factor,
      keywords,
      is_active,
      updated_at
    )
    values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
      $21,$22,$23,$24,$25,true,now()
    )
    on conflict (factor_id) do update set
      activity_id = excluded.activity_id,
      use_case = excluded.use_case,
      name = excluded.name,
      sector = excluded.sector,
      category = excluded.category,
      country_name = excluded.country_name,
      region = excluded.region,
      source = excluded.source,
      source_dataset = excluded.source_dataset,
      source_link = excluded.source_link,
      source_lca_activity = excluded.source_lca_activity,
      year = excluded.year,
      year_released = excluded.year_released,
      unit_type = excluded.unit_type,
      unit = excluded.unit,
      factor = excluded.factor,
      factor_calculation_method = excluded.factor_calculation_method,
      factor_calculation_origin = excluded.factor_calculation_origin,
      scopes = excluded.scopes,
      supported_calculation_methods = excluded.supported_calculation_methods,
      constituent_gases = excluded.constituent_gases,
      additional_indicators = excluded.additional_indicators,
      raw_factor = excluded.raw_factor,
      keywords = excluded.keywords,
      is_active = true,
      updated_at = now()
    `,
    [
      factorId,
      raw.activity_id || null,
      raw.use_case || null,
      name,
      raw.sector || null,
      raw.category || null,
      raw.region_name || raw.country_name || null,
      region,
      raw.source || null,
      raw.source_dataset || null,
      raw.source_link || null,
      raw.source_lca_activity || null,
      raw.year ? Number(raw.year) : null,
      raw.year_released ? Number(raw.year_released) : null,
      raw.unit_type || null,
      raw.unit || null,
      factor,
      raw.factor_calculation_method || null,
      raw.factor_calculation_origin || null,
      normalizeArray(raw.scopes),
      normalizeArray(raw.supported_calculation_methods),
      JSON.stringify(raw.constituent_gases || {}),
      JSON.stringify(raw.additional_indicators || {}),
      JSON.stringify(raw),
      buildKeywords(raw),
    ]
  );
}