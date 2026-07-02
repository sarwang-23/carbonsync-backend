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

  if (!mapping) {
    return {
      success: false,
      status: "review",
      source_engine: "climatiq",
      region: "IN",
      country_name: "India",
      category: input.category,
      reason: "NO_INDIA_CLIMATIQ_MAPPING",
      message: `No India Climatiq fallback mapping found for category: ${input.category}`,
    };
  }

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
    const searchQuery = `${input.category} ${input.itemName} India`;

    let searchedFactor = await searchClimatiqFactor({
      query: searchQuery,
      region: "IN",
      dataVersion: mapping.data_version || "^6",
      resultsPerPage: 10,
    });

    if (!searchedFactor?.activity_id) {
      // Fallback 1: GLOBAL region
      const globalSearchQuery = `${input.category} ${input.itemName}`;
      searchedFactor = await searchClimatiqFactor({
        query: globalSearchQuery,
        region: "GLO",
        dataVersion: mapping.data_version || "^6",
        resultsPerPage: 10,
      });
      if (searchedFactor?.activity_id) targetRegion = "GLO";
    }

    if (!searchedFactor?.activity_id) {
      // Fallback 2: RoW region (Rest of World)
      const rowSearchQuery = `${input.category} ${input.itemName}`;
      searchedFactor = await searchClimatiqFactor({
        query: rowSearchQuery,
        region: "RoW",
        dataVersion: mapping.data_version || "^6",
        resultsPerPage: 10,
      });
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
