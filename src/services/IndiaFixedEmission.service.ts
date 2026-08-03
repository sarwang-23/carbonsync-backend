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

    if (u !== "km" && u !== "kms" && u !== "passenger-km" && u !== "passenger km" && u !== "pkm") {
      return {
        success: false,
        status: "review",
        region: "IN",
        country_name: "India",
        category: "flight",
        source_engine: "india_fixed_ef",
        reason: "UNIT_MISMATCH",
        message: `Flight fixed EF expects km or passenger-km, received ${input.unit}`,
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
      category: "flight",
      factor_name: "India fixed flight emission factor",
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

  // ── Hardcoded India Fixed EF (fallback when DB table is missing) ─────────
  const INDIA_HARDCODED_FACTORS: Record<string, { factor: number; unit: string; name: string; source: string }> = {
    electricity:  { factor: 0.71,   unit: "kg/kWh",   name: "India fixed electricity emission factor",     source: "CEA 2023" },
    natural_gas:  { factor: 2.02,   unit: "kg/scm",   name: "India fixed natural gas emission factor",     source: "MoEFCC 2023" },
    diesel:       { factor: 2.68,   unit: "kg/litre", name: "India fixed diesel emission factor",          source: "MoEFCC 2023" },
    petrol:       { factor: 2.31,   unit: "kg/litre", name: "India fixed petrol emission factor",          source: "MoEFCC 2023" },
    coal:         { factor: 2.42,   unit: "kg/kg",    name: "India fixed coal emission factor",            source: "MoEFCC 2023" },
    lpg:          { factor: 1.61,   unit: "kg/litre", name: "India fixed LPG emission factor",             source: "MoEFCC 2023" },
    furnace_oil:  { factor: 3.15,   unit: "kg/litre", name: "India fixed furnace oil emission factor",     source: "MoEFCC 2023" },
    biomass:      { factor: 0.0,    unit: "kg/kg",    name: "India biomass emission factor",               source: "IPCC 2006" },
    png:          { factor: 2.02,   unit: "kg/scm",   name: "India fixed PNG emission factor",             source: "MoEFCC 2023" },
    cng:          { factor: 1.96,   unit: "kg/kg",    name: "India fixed CNG emission factor",             source: "MoEFCC 2023" },
  };

  let factorRow: { factor: number; unit: string; factor_name: string; source: string; source_dataset: string; year: number } | null = null;

  // Try DB first
  try {
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
    if (result.rows[0]) {
      const r = result.rows[0];
      factorRow = { factor: Number(r.factor), unit: r.unit, factor_name: r.factor_name, source: r.source, source_dataset: r.source_dataset, year: r.year };
    }
  } catch (dbErr: any) {
    console.warn(`[IndiaFixedEF] DB error for category=${input.category}:`, dbErr.message);
  }

  // Fallback to hardcoded factors if DB is missing
  if (!factorRow) {
    const categoryKey = input.category.toLowerCase();
    const hardcoded = INDIA_HARDCODED_FACTORS[categoryKey];
    if (hardcoded) {
      console.log(`[IndiaFixedEF] Using hardcoded factor for category=${input.category}: ${hardcoded.factor} ${hardcoded.unit}`);
      factorRow = { factor: hardcoded.factor, unit: hardcoded.unit, factor_name: hardcoded.name, source: hardcoded.source, source_dataset: "CarbonSync India Fixed Factors", year: 2023 };
    }
  }

  const factor = factorRow;

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
