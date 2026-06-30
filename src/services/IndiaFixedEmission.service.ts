import { pool } from "../db.js";

type IndiaFixedInput = {
  category: string;
  value: number;
  unit: string;
};

function normalizeUnit(unit: string) {
  return unit
    .toLowerCase()
    .replace("co2e", "")
    .replace("co₂", "")
    .replace("kilowatt hour", "kwh")
    .replace("kilowatt-hour", "kwh")
    .replace("kwj", "kwh")
    .replace("passenger km", "passenger-km")
    .replace("passenger/km", "passenger-km")
    .replace("pkm", "passenger-km")
    .replace("kilometre", "km")
    .replace("kilometer", "km")
    .replace("kms", "km")
    .trim();
}

function factorUnitMatches(invoiceUnit: string, factorUnit: string) {
  const u = normalizeUnit(invoiceUnit);
  const f = normalizeUnit(factorUnit);

  if (f === "kg/kwh" && u === "kwh") return true;
  if (f === "kg/passenger-km" && u === "passenger-km") return true;
  if (f === "kg/km" && u === "km") return true;

  return false;
}

export async function calculateIndiaFixedEmission(input: IndiaFixedInput) {
  const result = await pool.query(
    `
    select
      category,
      factor_name,
      factor,
      unit,
      source,
      source_dataset,
      year,
      notes
    from india_fixed_emission_factors
    where category = $1
      and is_active = true
    order by year desc nulls last
    limit 1
    `,
    [input.category]
  );

  const factor = result.rows[0];

  if (!factor) {
    return {
      success: false,
      region: "IN",
      country_name: "India",
      category: input.category,
      status: "review",
      reason: "INDIA_FIXED_EF_NOT_AVAILABLE",
      message: `India fixed EF is not available for category: ${input.category}`,
    };
  }

  if (!factorUnitMatches(input.unit, factor.unit)) {
    return {
      success: false,
      region: "IN",
      country_name: "India",
      category: input.category,
      status: "review",
      reason: "UNIT_MISMATCH",
      message: `Invoice unit ${input.unit} does not match fixed EF unit ${factor.unit}`,
      expected_factor_unit: factor.unit,
    };
  }

  const co2e = Number(input.value) * Number(factor.factor);

  return {
    success: true,
    status: "calculated",
    source_engine: "india_fixed_ef",
    preferred_source: factor.source || "India Fixed EF",
    region: "IN",
    country_name: "India",
    category: input.category,
    input_value: Number(input.value),
    input_unit: input.unit,
    factor_name: factor.factor_name,
    factor_value: Number(factor.factor),
    factor_unit: factor.unit,
    source_dataset: factor.source_dataset,
    year: factor.year,
    converted: {
      value: Number(input.value),
      unit: input.unit,
      converted: false,
    },
    co2e: Number(co2e.toFixed(6)),
    co2e_unit: "kg",
  };
}
