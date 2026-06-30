import { pool } from "../db.js";
import { estimateWithClimatiq } from "./climatiq.service.js";
import { searchClimatiqFactor } from "./ClimatiqSearch.service.js";

type ClimatiqFallbackInput = {
  region: string;
  countryName: string;
  category: string;
  itemName: string;
  value: number;
  unit: string;
};

function normalizeUnit(unit: string) {
  return unit
    .toLowerCase()
    .replace("kilowatt hour", "kwh")
    .replace("kilowatt-hour", "kwh")
    .replace("kwj", "kwh")
    .replace("kilogram", "kg")
    .replace("kgs", "kg")
    .replace("tonnes", "tonne")
    .replace("tons", "tonne")
    .replace("litre", "l")
    .replace("liter", "l")
    .replace("kilometre", "km")
    .replace("kilometer", "km")
    .trim();
}

function convertForClimatiq(input: {
  category: string;
  value: number;
  unit: string;
  expectedParameterName: string | null;
  expectedParameterUnit: string | null;
}) {
  const unit = normalizeUnit(input.unit);

  if (input.expectedParameterName === "energy") {
    if (unit === "kwh") {
      return {
        value: input.value,
        parameterName: "energy",
        parameterUnit: "kWh",
        converted: false,
      };
    }
  }

  if (input.expectedParameterName === "weight") {
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

  if (input.expectedParameterName === "distance") {
    if (unit === "km") {
      return {
        value: input.value,
        parameterName: "distance",
        parameterUnit: "km",
        converted: false,
      };
    }
  }

  if (input.expectedParameterName === "volume") {
    if (unit === "m3" || unit === "m³") {
      return {
        value: input.value,
        parameterName: "volume",
        parameterUnit: "m3",
        converted: false,
      };
    }
  }

  if (input.expectedParameterName === "weight_distance") {
    if (
      unit === "tonne-km" ||
      unit === "tonne km" ||
      unit === "tkm"
    ) {
      return {
        value: input.value,
        parameterName: "weight_distance",
        parameterUnit: "tonne-km",
        converted: false,
      };
    }
  }

  if (input.expectedParameterName === "money") {
    return {
      value: input.value,
      parameterName: "money",
      parameterUnit: input.expectedParameterUnit || input.unit,
      converted: false,
    };
  }

  return {
    value: input.value,
    parameterName: input.expectedParameterName || "energy",
    parameterUnit: input.expectedParameterUnit || input.unit,
    converted: false,
    review_required: true,
    reason: "UNIT_CONVERSION_NOT_SUPPORTED",
  };
}

async function getFallbackMapping(region: string, category: string) {
  const result = await pool.query(
    `
    select
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
    where region = $1
      and category = $2
      and preferred_source = 'Climatiq'
      and is_active = true
    order by id asc
    limit 1
    `,
    [region, category]
  );

  return result.rows[0] || null;
}

export async function calculateWithClimatiqFallback(input: ClimatiqFallbackInput) {
  const mapping = await getFallbackMapping(input.region, input.category);

  if (!mapping) {
    return {
      success: false,
      status: "review",
      source_engine: "climatiq",
      region: input.region,
      country_name: input.countryName,
      category: input.category,
      reason: "NO_CLIMATIQ_FALLBACK_MAPPING",
      message: `No Climatiq fallback mapping found for ${input.region}/${input.category}`,
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
      region: input.region,
      country_name: input.countryName,
      category: input.category,
      reason: (converted as any).reason,
      message: `Unit conversion not supported for ${input.category}: ${input.unit}`,
    };
  }

  let activityId = mapping.activity_id;

  if (!activityId) {
    const searchQuery = `${input.category} ${input.itemName}`;

    const searchedFactor = await searchClimatiqFactor({
      query: searchQuery,
      region: input.region,
      dataVersion: mapping.data_version || "^6",
      resultsPerPage: 10,
    });

    if (!searchedFactor?.activity_id) {
      return {
        success: false,
        status: "review",
        source_engine: "climatiq",
        region: input.region,
        country_name: input.countryName,
        category: input.category,
        reason: "CLIMATIQ_FACTOR_NOT_FOUND",
        message: `No Climatiq factor found for ${input.region}/${input.category}`,
      };
    }

    activityId = searchedFactor.activity_id;
  }

  const climatiqResult = await estimateWithClimatiq({
    selectedEF: {
      activity_id: activityId,
      region: input.region,
      year: 2024,
    },
    parameters: {
      [converted.parameterName]: converted.value,
    }
  });

  return {
    success: true,
    status: "calculated",
    source_engine: "climatiq",
    preferred_source: "Climatiq",
    region: input.region,
    country_name: input.countryName,
    category: input.category,
    item_name: input.itemName,
    input_value: input.value,
    input_unit: input.unit,
    converted,
    activity_id: activityId,
    parameter_name: converted.parameterName,
    parameter_unit: converted.parameterUnit,
    co2e: climatiqResult.data.co2e,
    co2e_unit: climatiqResult.data.co2e_unit,
    factor_name: climatiqResult.data.emission_factor?.name,
    factor_source: climatiqResult.data.emission_factor?.source,
    factor_region: climatiqResult.data.emission_factor?.region,
  };
}
