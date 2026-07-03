import { pool } from "../db.js";
import { estimateWithClimatiqDirect } from "./climatiq.service.js";
import { searchClimatiqFactor } from "./ClimatiqSearch.service.js";
import { normalizeUnit } from "./UnitConversion.service.js";

type IndiaClimatiqFallbackInput = {
  category: string;
  itemName: string;
  value: number;
  unit: string;
};

const WEIGHT_CATEGORIES = [
  "steel",
  "aluminium",
  "textile",
  "electrical",
  "lpg",
  "coal",
  "cement",
  "concrete",
  "glass",
  "plastic",
  "paper",
  "wood",
  "food",
  "chemicals",
  "refrigerant",
  "waste",
];

const ENERGY_CATEGORIES = ["diesel", "petrol", "natural_gas"];

const VOLUME_CATEGORIES = ["water"];

const DISTANCE_CATEGORIES = ["transport"];

const MONEY_CATEGORIES = [
  "hotel",
  "banking",
  "university",
  "exporter",
  "manufacturing",
  "services",
];

function convertForClimatiq(input: {
  category: string;
  value: number;
  unit: string;
  expectedParameterName: string | null;
  expectedParameterUnit: string | null;
}) {
  const unit = normalizeUnit(input.unit);

  // ── Weight-based categories ─────────────────────────────────────────────
  if (
    input.expectedParameterName === "weight" ||
    WEIGHT_CATEGORIES.includes(input.category)
  ) {
    if (unit === "kg") {
      return {
        value: input.value,
        parameterName: "weight",
        parameterUnit: "kg",
        converted: false,
      };
    }

    if (unit === "tonne" || unit === "t") {
      return {
        value: input.value * 1000,
        parameterName: "weight",
        parameterUnit: "kg",
        converted: true,
        conversion_note: "Converted tonne to kg",
      };
    }
  }

  // ── Energy-based categories ─────────────────────────────────────────────
  if (
    input.expectedParameterName === "energy" ||
    ENERGY_CATEGORIES.includes(input.category)
  ) {
    if (unit === "kwh" || unit === "kwj") {
      return {
        value: input.value,
        parameterName: "energy",
        parameterUnit: "kWh",
        converted: false,
      };
    }

    if (input.category === "diesel" && (unit === "l" || unit === "ltr")) {
      return {
        value: Number((input.value * 10).toFixed(6)),
        parameterName: "energy",
        parameterUnit: "kWh",
        converted: true,
        conversion_note: "Converted diesel litre to kWh using approx 10 kWh/litre",
      };
    }

    if (input.category === "petrol" && (unit === "l" || unit === "ltr")) {
      return {
        value: Number((input.value * 8.9).toFixed(6)),
        parameterName: "energy",
        parameterUnit: "kWh",
        converted: true,
        conversion_note: "Converted petrol litre to kWh using approx 8.9 kWh/litre",
      };
    }
  }

  // ── Volume-based categories ─────────────────────────────────────────────
  if (
    input.expectedParameterName === "volume" ||
    VOLUME_CATEGORIES.includes(input.category)
  ) {
    if (unit === "m3" || unit === "m³" || unit === "cubic metre") {
      return {
        value: input.value,
        parameterName: "volume",
        parameterUnit: "m3",
        converted: false,
      };
    }

    if (unit === "l" || unit === "litre" || unit === "liter") {
      return {
        value: Number((input.value / 1000).toFixed(6)),
        parameterName: "volume",
        parameterUnit: "m3",
        converted: true,
        conversion_note: "Converted litres to m3",
      };
    }
  }

  // ── Distance-based categories ───────────────────────────────────────────
  if (
    input.expectedParameterName === "distance" ||
    DISTANCE_CATEGORIES.includes(input.category)
  ) {
    if (unit === "km" || unit === "kilometer" || unit === "kilometre") {
      return {
        value: input.value,
        parameterName: "distance",
        parameterUnit: "km",
        converted: false,
      };
    }
  }

  // ── Money/spend-based categories ────────────────────────────────────────
  if (
    input.expectedParameterName === "money" ||
    MONEY_CATEGORIES.includes(input.category)
  ) {
    return {
      value: input.value,
      parameterName: "money",
      parameterUnit: input.expectedParameterUnit || "usd",
      converted: false,
    };
  }

  // ── Freight: weight_distance ─────────────────────────────────────────────
  if (
    input.expectedParameterName === "weight_distance" ||
    input.category === "freight"
  ) {
    if (
      unit === "tonnekm" ||
      unit === "tkm"
    ) {
      return {
        value: input.value,
        parameterName: "weight_distance",
        parameterUnit: "tonne-km",
        converted: false,
        parameters: {
          weight: 1,
          weight_unit: "t",
          distance: input.value,
          distance_unit: "km"
        }
      };
    }
  }

  return {
    value: input.value,
    parameterName: input.expectedParameterName || "weight",
    parameterUnit: input.expectedParameterUnit || input.unit,
    converted: false,
    review_required: true,
    reason: "UNIT_CONVERSION_NOT_SUPPORTED",
  };
}

async function getIndiaFallbackMapping(category: string) {
  const result = await pool.query(
    `
    select
      id,
      region,
      country_name,
      category,
      keywords,
      activity_id,
      preferred_source,
      preferred_lca_activity,
      parameter_name,
      parameter_unit,
      data_version
    from emission_factor_mappings
    where region = 'IN'
      and category = $1
      and preferred_source = 'Climatiq'
      and is_active = true
    order by id asc
    limit 1
    `,
    [category]
  );

  return result.rows[0] || null;
}

export async function calculateIndiaClimatiqFallback(
  input: IndiaClimatiqFallbackInput
) {
  const mapping = await getIndiaFallbackMapping(input.category);

  // ── No DB mapping: infer defaults and still try Climatiq search ──────────
  if (!mapping) {
    console.log(`[IN] No DB mapping for "${input.category}" — attempting direct Climatiq search`);

    const cleanItemName = input.itemName
      .replace(/[^a-zA-Z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 3)
      .join(" ");

    // Infer parameter based on category lists
    let inferredParameterName = "weight";
    let inferredParameterUnit = "kg";
    if (ENERGY_CATEGORIES.includes(input.category)) {
      inferredParameterName = "energy";
      inferredParameterUnit = "kWh";
    } else if (VOLUME_CATEGORIES.includes(input.category)) {
      inferredParameterName = "volume";
      inferredParameterUnit = "m3";
    } else if (DISTANCE_CATEGORIES.includes(input.category)) {
      inferredParameterName = "distance";
      inferredParameterUnit = "km";
    }

    // Convert value using inferred parameter
    const converted = convertForClimatiq({
      category: input.category,
      value: input.value,
      unit: input.unit,
      expectedParameterName: inferredParameterName,
      expectedParameterUnit: inferredParameterUnit,
    });

    // Search IN → GLO → RoW
    let searchedFactor: any = null;
    let targetRegion: string | undefined = "IN";

    const searchQuery = `${input.category} ${cleanItemName}`;
    const genericQuery = input.category;

    searchedFactor = await searchClimatiqFactor({ query: searchQuery, region: "IN", dataVersion: "^6", resultsPerPage: 10 });
    if (!searchedFactor?.activity_id) {
      searchedFactor = await searchClimatiqFactor({ query: genericQuery, region: "IN", dataVersion: "^6", resultsPerPage: 1 });
    }

    if (!searchedFactor?.activity_id) {
      searchedFactor = await searchClimatiqFactor({ query: searchQuery, region: "GLO", dataVersion: "^6", resultsPerPage: 10 });
      if (!searchedFactor?.activity_id) {
        searchedFactor = await searchClimatiqFactor({ query: genericQuery, region: "GLO", dataVersion: "^6", resultsPerPage: 1 });
      }
      if (searchedFactor?.activity_id) targetRegion = "GLO";
    }

    if (!searchedFactor?.activity_id) {
      searchedFactor = await searchClimatiqFactor({ query: searchQuery, region: "RoW", dataVersion: "^6", resultsPerPage: 10 });
      if (!searchedFactor?.activity_id) {
        searchedFactor = await searchClimatiqFactor({ query: genericQuery, region: "RoW", dataVersion: "^6", resultsPerPage: 1 });
      }
      if (searchedFactor?.activity_id) targetRegion = "RoW";
    }

    if (!searchedFactor?.activity_id) {
      return {
        success: false,
        status: "review",
        source_engine: "climatiq",
        region: "IN",
        country_name: "India",
        category: input.category,
        reason: "NO_INDIA_CLIMATIQ_MAPPING",
        message: `No Climatiq factor found for category: ${input.category} (IN/GLO/RoW)`,
      };
    }

    console.log(`[IN] No-mapping Climatiq search found: ${searchedFactor.activity_id} (region: ${targetRegion})`);

    try {
      const climatiqResult = await estimateWithClimatiqDirect({
        activityId: searchedFactor.activity_id,
        parameterName: converted.parameterName,
        value: converted.value,
        parameterUnit: converted.parameterUnit,
        dataVersion: "^6",
        region: targetRegion,
      });

      return {
        success: true,
        status: "calculated",
        source_engine: "climatiq",
        preferred_source: "Climatiq",
        region: "IN",
        country_name: "India",
        category: input.category,
        item_name: input.itemName,
        input_value: input.value,
        input_unit: input.unit,
        converted,
        activity_id: searchedFactor.activity_id,
        parameter_name: converted.parameterName,
        parameter_unit: converted.parameterUnit,
        co2e: climatiqResult.co2e,
        co2e_unit: climatiqResult.co2e_unit,
        factor_name: climatiqResult.factor_name,
        factor_source: climatiqResult.factor_source,
        factor_region: climatiqResult.factor_region,
        raw: climatiqResult.raw,
      };
    } catch (err: any) {
      return {
        success: false,
        status: "review",
        source_engine: "climatiq",
        region: "IN",
        country_name: "India",
        category: input.category,
        reason: "CLIMATIQ_API_ERROR",
        message: err.message || "Climatiq API call failed",
      };
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const converted = convertForClimatiq({
    category: input.category,
    value: input.value,
    unit: input.unit,
    expectedParameterName: mapping.parameter_name,
    expectedParameterUnit: mapping.parameter_unit,
  });

  if ((converted as any).review_required) {
    return {
      success: false,
      status: "review",
      source_engine: "climatiq",
      region: "IN",
      country_name: "India",
      category: input.category,
      value: input.value,
      unit: input.unit,
      reason: (converted as any).reason,
      message: `Unit conversion not supported for ${input.category}: ${input.unit}`,
    };
  }

  let activityId = mapping.activity_id;
  let targetRegion: string | undefined = "IN";

  if (!activityId) {
    const cleanItemName = input.itemName
      .replace(/[^a-zA-Z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 3)
      .join(" ");

    // ── Smart steel activity mapping ──────────────────────────────────────
    // MS / TMT / billet / round bar → generic "steel bars rods" to avoid
    // picking up "alloy steel forged" factors for ordinary mild steel.
    let searchQuery: string;
    let genericQuery: string = input.category;

    if (input.category === "steel") {
      const nameLower = input.itemName.toLowerCase();
      if (
        nameLower.includes("ms billet") ||
        nameLower.includes("ms bar") ||
        nameLower.includes("tmt") ||
        nameLower.includes("billet") ||
        nameLower.includes("round bar") ||
        nameLower.includes("mild steel")
      ) {
        searchQuery = "steel bars rods";
      } else if (nameLower.includes("sheet") || nameLower.includes("coil") || nameLower.includes("plate")) {
        searchQuery = "steel sheet plate coil";
      } else if (nameLower.includes("pipe") || nameLower.includes("tube")) {
        searchQuery = "steel pipe tube";
      } else {
        searchQuery = `steel ${cleanItemName}`;
      }
    } else {
      searchQuery = `${input.category} ${cleanItemName} India`;
    }
    // ─────────────────────────────────────────────────────────────────────

    let searchedFactor = await searchClimatiqFactor({
      query: searchQuery,
      region: "IN",
      dataVersion: mapping.data_version || "^6",
      resultsPerPage: 10,
    });
    if (!searchedFactor?.activity_id) {
        searchedFactor = await searchClimatiqFactor({ query: genericQuery, region: "IN", dataVersion: mapping.data_version || "^6", resultsPerPage: 1 });
    }

    if (!searchedFactor?.activity_id) {
      // Fallback 1: GLOBAL region
      const globalSearchQuery = `${input.category} ${cleanItemName}`;
      searchedFactor = await searchClimatiqFactor({
        query: globalSearchQuery,
        region: "GLO",
        dataVersion: mapping.data_version || "^6",
        resultsPerPage: 10,
      });
      if (!searchedFactor?.activity_id) {
          searchedFactor = await searchClimatiqFactor({ query: genericQuery, region: "GLO", dataVersion: mapping.data_version || "^6", resultsPerPage: 1 });
      }
      if (searchedFactor?.activity_id) targetRegion = "GLO";
    }

    if (!searchedFactor?.activity_id) {
      // Fallback 2: RoW region (Rest of World)
      const rowSearchQuery = `${input.category} ${cleanItemName}`;
      searchedFactor = await searchClimatiqFactor({
        query: rowSearchQuery,
        region: "RoW",
        dataVersion: mapping.data_version || "^6",
        resultsPerPage: 10,
      });
      if (!searchedFactor?.activity_id) {
          searchedFactor = await searchClimatiqFactor({ query: genericQuery, region: "RoW", dataVersion: mapping.data_version || "^6", resultsPerPage: 1 });
      }
      if (searchedFactor?.activity_id) targetRegion = "RoW";
    }

    if (!searchedFactor?.activity_id) {
      return {
        success: false,
        status: "review",
        source_engine: "climatiq",
        region: "IN",
        country_name: "India",
        category: input.category,
        reason: "CLIMATIQ_FACTOR_NOT_FOUND",
        message: `No Climatiq factor found for India, GLO, or RoW for category: ${input.category}`,
      };
    }

    activityId = searchedFactor.activity_id;
  }

  let climatiqResult: any = null;

  try {
    climatiqResult = await estimateWithClimatiqDirect({
      activityId,
      parameterName: converted.parameterName,
      value: converted.value,
      parameterUnit: converted.parameterUnit,
      dataVersion: mapping.data_version || "^6",
      region: targetRegion,
      parameters: (converted as any).parameters
    });
  } catch (error: any) {
    // If specific region factor fails (e.g. mapping had IN but factor is global), try without region constraint
    if (error.message && error.message.includes("No emission factors could be found")) {
      try {
        climatiqResult = await estimateWithClimatiqDirect({
          activityId,
          parameterName: converted.parameterName,
          value: converted.value,
          parameterUnit: converted.parameterUnit,
          dataVersion: mapping.data_version || "^6",
          region: undefined, // GLOBAL fallback
          parameters: (converted as any).parameters
        });
      } catch (fallbackError: any) {
        throw fallbackError;
      }
    } else {
      throw error;
    }
  }

  return {
    success: true,
    status: "calculated",
    source_engine: "climatiq",
    preferred_source: "Climatiq",
    region: "IN",
    country_name: "India",
    category: input.category,
    item_name: input.itemName,
    input_value: input.value,
    input_unit: input.unit,
    converted,
    activity_id: activityId,
    parameter_name: converted.parameterName,
    parameter_unit: converted.parameterUnit,
    co2e: climatiqResult.co2e,
    co2e_unit: climatiqResult.co2e_unit,
    factor_name: climatiqResult.factor_name,
    factor_source: climatiqResult.factor_source,
    factor_region: climatiqResult.factor_region,
    raw: climatiqResult.raw,
  };
}
