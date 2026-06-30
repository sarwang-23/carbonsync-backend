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
  if (input.category === "flight") {
    const factor = 0.18;
    const u = input.unit.toLowerCase();

    if (u !== "km" && u !== "kms") {
      return {
        success: false,
        status: "review",
        region: "IN",
        country_name: "India",
        category: "flight",
        source_engine: "india_fixed_ef",
        reason: "UNIT_MISMATCH",
        message: `Flight fixed EF expects km, received ${input.unit}`,
        expected_factor_unit: "kg/km",
      };
    }

    return {
      success: true,
      status: "calculated",
      source_engine: "india_fixed_ef",
      preferred_source: "India Fixed EF",
      region: "IN",
      country_name: "India",
      category: "flight",
      factor_name: "India fixed flight emission factor",
      factor_value: factor,
      factor_unit: "kg/km",
      source_dataset: "CarbonSync India fixed factors",
      year: 2025,
      converted: {
        value: Number(input.value),
        unit: "km",
        converted: false,
      },
      co2e: Number((Number(input.value) * factor).toFixed(6)),
      co2e_unit: "kg",
    };
  }

  if (input.category === "railway") {
    const factor = 0.007976;
    const u = input.unit.toLowerCase();

    if (u !== "passenger-km" && u !== "passenger km" && u !== "pkm") {
      return {
        success: false,
        status: "review",
        region: "IN",
        country_name: "India",
        category: "railway",
        source_engine: "india_fixed_ef",
        reason: "UNIT_MISMATCH",
        message: `Railway fixed EF expects passenger-km, received ${input.unit}`,
        expected_factor_unit: "kg/passenger-km",
      };
    }

    return {
      success: true,
      status: "calculated",
      source_engine: "india_fixed_ef",
      preferred_source: "India Fixed EF",
      region: "IN",
      country_name: "India",
      category: "railway",
      factor_name: "India fixed railway emission factor",
      factor_value: factor,
      factor_unit: "kg/passenger-km",
      source_dataset: "CarbonSync India fixed factors",
      year: 2025,
      converted: {
        value: Number(input.value),
        unit: "passenger-km",
        converted: false,
      },
      co2e: Number((Number(input.value) * factor).toFixed(6)),
      co2e_unit: "kg",
    };
  }

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
