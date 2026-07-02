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
    if (unit === "mj" || unit === "megajoule") {
      return {
        value: input.value * 0.277778, // 1 MJ = 0.277778 kWh
        parameterName: "energy",
        parameterUnit: "kWh",
        converted: true,
        conversion_note: "Converted MJ to kWh",
      };
    }
    if (unit === "scf") {
      return {
        value: input.value * 0.303914, // 1 scf = ~1037 BTU = 0.303914 kWh
        parameterName: "energy",
        parameterUnit: "kWh",
        converted: true,
        conversion_note: "Converted scf to kWh",
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

    if (unit === "t" || unit === "tonne") {
      // Keep as tonnes — Climatiq accepts 't' natively for fuel weight factors
      return {
        value: input.value,
        parameterName: "weight",
        parameterUnit: "t",
        converted: false,
      };
    }
    if (unit === "shortton" || unit === "short_ton") {
      return {
        value: input.value * 907.185,
        parameterName: "weight",
        parameterUnit: "kg",
        converted: true,
        conversion_note: "Converted short ton to kg",
      };
    }
  }

  if (["distance", "passengers", "passenger_distance", "weight_distance"].includes(input.expectedParameterName || "")) {
    // Plain km — used directly as distance
    if (unit === "km") {
      const isPassengerActivity = input.category === "flight" || input.category === "railway";
      return {
        value: input.value,
        parameterName: "distance",
        parameterUnit: "km",
        ...(isPassengerActivity ? {
          extraParameterName: "passengers",
          extraParameterValue: 1,
          extraParameterUnit: null,
        } : {}),
        converted: false,
      };
    }

    // passenger-km (e.g. "passenger-km", "pkm") → extract as distance + passengers=1
    if (unit === "passengerkm" || unit === "pkm") {
      return {
        value: input.value,
        parameterName: "distance",
        parameterUnit: "km",
        extraParameterName: "passengers",
        extraParameterValue: 1,
        extraParameterUnit: null,
        converted: true,
        conversion_note: "Treated passenger-km as distance km with 1 passenger",
      };
    }

    // tonne-km for freight → send weight=1t + distance=value km
    // Climatiq freight_vehicle expects WeightOverDistance: weight(t) × distance(km)
    if (unit === "tonnekm" || unit === "tkm") {
      return {
        value: 1,                       // weight = 1 tonne
        parameterName: "weight",
        parameterUnit: "t",
        extraParameterName: "distance",
        extraParameterValue: input.value, // distance = tonne-km value (because weight=1t)
        extraParameterUnit: "km",
        converted: true,
        conversion_note: `Converted ${input.value} tonne-km to weight=1t + distance=${input.value}km`,
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
    if (unit === "l" || unit === "litre") {
      return {
        value: input.value,
        parameterName: "volume",
        parameterUnit: "l",
        converted: false,
      };
    }
    if (unit === "gallon" || unit === "gal") {
      return {
        value: input.value,
        parameterName: "volume",
        parameterUnit: "gallons_us",
        converted: false,
      };
    }
    if (unit === "scf") {
      return {
        value: input.value,
        parameterName: "volume",
        parameterUnit: "scf",
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
    const cleanItemName = input.itemName
      .replace(/[^a-zA-Z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 3)
      .join(" ");

    const searchQuery = `${input.category} ${cleanItemName}`;
    const genericQuery = `${input.category}`;

    let searchedFactor = await searchClimatiqFactor({
      query: searchQuery,
      region: input.region,
      dataVersion: mapping.data_version || "^6",
      resultsPerPage: 10,
    });

    if (!searchedFactor?.activity_id) {
        searchedFactor = await searchClimatiqFactor({ query: genericQuery, region: input.region, dataVersion: mapping.data_version || "^6", resultsPerPage: 1 });
    }

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

  console.log(`\nSearching Climatiq...`);
  console.log(`Category:\n${input.category}`);
  console.log(`Region:\n${input.region}`);
  console.log(`Unit:\n${input.unit}`);
  console.log(`Activity sent:\n${activityId}`);

  // These categories have no region-specific Climatiq factors — use global (omit region)
  // petrol, lpg: Climatiq only has global factors for these fuels
  // freight, railway, flight, coal: transport/solid fuel factors are global
  const GLOBAL_ONLY_CATEGORIES = new Set(['freight', 'railway', 'flight', 'coal', 'petrol', 'lpg']);
  const climatiqRegion = GLOBAL_ONLY_CATEGORIES.has(input.category) ? undefined : input.region;

  try {
    let climatiqResult: any;
    
    try {
      climatiqResult = await estimateWithClimatiq({
        selectedEF: {
          activity_id: activityId,
          ...(climatiqRegion ? { region: climatiqRegion } : {}),
        },
        parameters: {
          [converted.parameterName]: converted.value,
          ...(converted.parameterUnit ? { [`${converted.parameterName}_unit`]: converted.parameterUnit } : {}),
          ...((converted as any).extraParameterName ? {
            [(converted as any).extraParameterName]: (converted as any).extraParameterValue,
            ...((converted as any).extraParameterUnit ? { [`${(converted as any).extraParameterName}_unit`]: (converted as any).extraParameterUnit } : {})
          } : {}),
        }
      });
    } catch (initialError: any) {
      // If it failed and we provided a region, try again WITHOUT the region (global fallback)
      if (climatiqRegion && initialError?.response?.data?.error_code === 'no_emission_factors_found') {
        console.log(`\nRegion specific factor not found for ${climatiqRegion}. Retrying without region...`);
        climatiqResult = await estimateWithClimatiq({
          selectedEF: {
            activity_id: activityId,
          },
          parameters: {
            [converted.parameterName]: converted.value,
            ...(converted.parameterUnit ? { [`${converted.parameterName}_unit`]: converted.parameterUnit } : {}),
            ...((converted as any).extraParameterName ? {
              [(converted as any).extraParameterName]: (converted as any).extraParameterValue,
              ...((converted as any).extraParameterUnit ? { [`${(converted as any).extraParameterName}_unit`]: (converted as any).extraParameterUnit } : {})
            } : {}),
          }
        });
      } else {
        throw initialError;
      }
    }

    console.log(`Status:\n200`);
    console.log(`Response:\n${JSON.stringify(climatiqResult.data)}`);

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
  } catch (error: any) {
    console.log(`Status:\n${error?.response?.status || 'Error'}`);
    console.log(`Response:\n${JSON.stringify(error?.response?.data || error?.message || error)}`);
    
    return {
      success: false,
      status: "review",
      source_engine: "climatiq",
      region: input.region,
      country_name: input.countryName,
      category: input.category,
      reason: "CLIMATIQ_ESTIMATION_FAILED",
      message: error?.response?.data?.message || error?.message || "Climatiq estimation failed",
    };
  }
}
