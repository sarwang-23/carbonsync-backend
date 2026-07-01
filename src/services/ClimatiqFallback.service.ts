import { pool } from "../db.js";
import { estimateWithClimatiq } from "./climatiq.service.js";
import { searchClimatiqFactor } from "./ClimatiqSearch.service.js";
import { normalizeUnit } from "./UnitConversion.service.js";

type ClimatiqFallbackInput = {
  region: string;
  countryName: string;
  category: string;
  itemName: string;
  value: number;
  unit: string;
};

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

  if (["distance", "passengers", "passenger_distance", "weight_distance"].includes(input.expectedParameterName || "")) {
    if (unit === "km") {
      return {
        value: input.value,
        parameterName: input.expectedParameterName as string,
        parameterUnit: "km",
        converted: false,
      };
    }

    if (unit === "tonnekm" || unit === "tkm") {
      if (input.expectedParameterName === "weight_distance") {
        return {
          value: input.value,
          parameterName: "weight",
          parameterUnit: "t", // Climatiq expects 't' for metric tonne
          extraParameterName: "distance",
          extraParameterValue: 1,
          extraParameterUnit: "km",
          converted: false,
        };
      }

      return {
        value: input.value,
        parameterName: input.expectedParameterName as string,
        parameterUnit: input.expectedParameterUnit || "tonne_km",
        converted: false,
      };
    }

    if (unit === "passengerkm" || unit === "pkm") {
      return {
        value: input.value,
        parameterName: input.expectedParameterName as string,
        parameterUnit: input.expectedParameterUnit || "passenger_km",
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

  if (input.expectedParameterName === "mass") {
    if (unit === "kg") {
      return {
        value: input.value,
        parameterName: "mass",
        parameterUnit: "kg",
        converted: false,
      };
    }

    if (unit === "tonne" || unit === "t") {
      return {
        value: input.value * 1000,
        parameterName: "mass",
        parameterUnit: "kg",
        converted: true,
        conversion_note: "Converted tonne to kg",
      };
    }

    if (unit === "shortton" || unit === "short_ton") {
      return {
        value: input.value * 907.185,
        parameterName: "mass",
        parameterUnit: "kg",
        converted: true,
        conversion_note: "Converted short ton to kg",
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

  // Some categories don't have US-specific Climatiq factors — use global (omit region)
  const GLOBAL_ONLY_CATEGORIES = new Set(['freight', 'railway', 'flight', 'coal']);
  const climatiqRegion = GLOBAL_ONLY_CATEGORIES.has(input.category) ? undefined : input.region;

  const climatiqResult = await estimateWithClimatiq({
    selectedEF: {
      activity_id: activityId,
      ...(climatiqRegion ? { region: climatiqRegion } : {}),
      year: 2024,
    },
    parameters: {
      [converted.parameterName]: converted.value,
      ...(converted.parameterUnit ? { [`${converted.parameterName}_unit`]: converted.parameterUnit } : {}),
      ...((converted as any).extraParameterName ? {
        [(converted as any).extraParameterName]: (converted as any).extraParameterValue,
        [`${(converted as any).extraParameterName}_unit`]: (converted as any).extraParameterUnit,
      } : {}),
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
