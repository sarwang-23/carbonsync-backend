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

  if (input.expectedParameterName === "number") {
    return {
      value: input.value,
      parameterName: "number",
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

  // ── No DB mapping: infer defaults and still try Climatiq search ──────────
  if (!mapping) {
    console.log(`[${input.region}] No DB mapping for "${input.category}" — attempting direct Climatiq search`);

    const cleanItemName = input.itemName
      .replace(/[^a-zA-Z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 3)
      .join(" ");

    const CLIMATIQ_CATEGORY_MAPPING: Record<string, string> = {
      "finished_steel": "steel",
      "semi_finished_steel": "steel",
      "raw_material_steel": "steel",
      "stainless_steel": "stainless steel",
      "alloy_steel": "alloy steel",
      "pig_iron": "pig iron",
      "dri": "direct reduced iron",
      "billet": "steel billet",
      "bloom": "steel bloom",
      "slab": "steel slab",
      "steel_scrap": "steel scrap",
      "ferro_alloy": "ferro alloy",
      "limestone": "limestone",
      "dolomite": "dolomite",
      "coke": "coke",
      "iron_ore": "iron ore"
    };

    // Infer parameter based on common category groups
    const WEIGHT_CATS = ["steel", "finished_steel", "semi_finished_steel", "raw_material_steel", "stainless_steel", "alloy_steel", "aluminium", "textile", "electrical", "lpg", "coal", "coke", "limestone", "dolomite", "ferro_alloy", "iron_ore", "pig_iron", "dri", "billet", "bloom", "slab", "steel_scrap", "cement", "concrete", "glass", "plastic", "paper", "wood", "food", "chemicals", "refrigerant", "waste", "purchased_goods"];
    const ENERGY_CATS = ["electricity", "diesel", "petrol", "natural_gas", "district_heating"];
    const VOLUME_CATS = ["water", "natural_gas"];
    const DISTANCE_CATS = ["transport", "freight", "flight", "railway"];
    const NUMBER_CATS = ["hotel"];

    let inferredParameterName = "weight";
    let inferredParameterUnit = "kg";
    if (ENERGY_CATS.includes(input.category)) {
      inferredParameterName = "energy";
      inferredParameterUnit = "kWh";
    } else if (VOLUME_CATS.includes(input.category)) {
      inferredParameterName = "volume";
      inferredParameterUnit = "m3";
    } else if (DISTANCE_CATS.includes(input.category)) {
      inferredParameterName = "distance";
      inferredParameterUnit = "km";
    } else if (NUMBER_CATS.includes(input.category)) {
      inferredParameterName = "number";
      inferredParameterUnit = "room";
    }

    const converted = convertForClimatiq({
      category: input.category,
      value: input.value,
      unit: input.unit,
      expectedParameterName: inferredParameterName,
      expectedParameterUnit: inferredParameterUnit,
    });

    // Search: region → GLO → RoW
    let searchedFactor: any = null;
    let targetRegion: string | undefined = input.region;

    const searchCategory = CLIMATIQ_CATEGORY_MAPPING[input.category] || input.category;
    const searchQuery = `${searchCategory} ${cleanItemName}`;
    const genericQuery = searchCategory;

    searchedFactor = await searchClimatiqFactor({ query: searchQuery, region: input.region, dataVersion: "^6", resultsPerPage: 10 });
    if (!searchedFactor?.activity_id) {
      searchedFactor = await searchClimatiqFactor({ query: genericQuery, region: input.region, dataVersion: "^6", resultsPerPage: 1 });
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
        region: input.region,
        country_name: input.countryName,
        category: input.category,
        reason: "NO_CLIMATIQ_FALLBACK_MAPPING",
        message: `No Climatiq factor found for ${input.region}/${input.category} (tried GLO/RoW too)`,
      };
    }

    console.log(`[${input.region}] No-mapping Climatiq search found: ${searchedFactor.activity_id} (region: ${targetRegion})`);

    // Helper: try Climatiq estimate with automatic unit-type retry
    const tryClimatiqWithRetry = async (actId: string, region: string | undefined, converted: any) => {
      const paramVariants = [
        // Primary attempt
        { [converted.parameterName]: converted.value, ...(converted.parameterUnit ? { [`${converted.parameterName}_unit`]: converted.parameterUnit } : {}) },
        // Retry 1: if primary was 'weight/kg' try 'mass/kg' (Climatiq sometimes uses mass)
        ...(converted.parameterName === "weight" ? [{ mass: converted.value, mass_unit: converted.parameterUnit || "kg" }] : []),
        // Retry 2: if primary was 'mass' try 'weight'
        ...(converted.parameterName === "mass" ? [{ weight: converted.value, weight_unit: converted.parameterUnit || "kg" }] : []),
        // Retry 3: if primary was 'weight/kg' try 'weight/t' (tonne)
        ...(converted.parameterName === "weight" && converted.parameterUnit === "kg" ? [{ weight: Number((converted.value / 1000).toFixed(6)), weight_unit: "t" }] : []),
        // Retry 4: if primary was 'weight/t' try 'weight/kg'
        ...(converted.parameterName === "weight" && (converted.parameterUnit === "t" || converted.parameterUnit === "tonne") ? [{ weight: converted.value * 1000, weight_unit: "kg" }] : []),
      ];

      for (let attempt = 0; attempt < paramVariants.length; attempt++) {
        try {
          const params = paramVariants[attempt];
          if (attempt > 0) {
            console.log(`[Climatiq Retry ${attempt}] Trying alternate params:`, params);
          }
          const result = await estimateWithClimatiq({
            selectedEF: { activity_id: actId, ...(region && region !== "GLO" && region !== "RoW" ? { region } : {}) },
            parameters: params,
          });
          return { result, usedParams: params };
        } catch (err: any) {
          const errCode = err?.response?.data?.error_code || "";
          const errMsg = String(err?.response?.data?.message || err?.message || "");
          const isUnitError = errCode === "no_compatible_unit_types" || errCode === "parameters_incorrect" || errMsg.includes("compatible") || errMsg.includes("unit_type") || errMsg.includes("parameters") || errMsg.includes("incorrect");
          // Only continue retrying for unit errors; rethrow other errors on last attempt
          if (!isUnitError || attempt === paramVariants.length - 1) throw err;
        }
      }
      throw new Error("All Climatiq parameter variants exhausted");
    };

    try {
      const { result: climatiqResult } = await tryClimatiqWithRetry(searchedFactor.activity_id, targetRegion, converted);

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
        activity_id: searchedFactor.activity_id,
        parameter_name: converted.parameterName,
        parameter_unit: converted.parameterUnit,
        co2e: climatiqResult.data.co2e,
        co2e_unit: climatiqResult.data.co2e_unit,
        factor_name: climatiqResult.data.emission_factor?.name,
        factor_source: climatiqResult.data.emission_factor?.source,
        factor_region: climatiqResult.data.emission_factor?.region,
      };
    } catch (err: any) {
      return {
        success: false,
        status: "review",
        source_engine: "climatiq",
        region: input.region,
        country_name: input.countryName,
        category: input.category,
        reason: "CLIMATIQ_API_ERROR",
        message: err?.response?.data?.message || err?.message || "Climatiq API call failed",
      };
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // mapping found path — convert units and get activityId
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

    const CLIMATIQ_CATEGORY_MAPPING: Record<string, string> = {
      "finished_steel": "steel",
      "semi_finished_steel": "steel",
      "raw_material_steel": "steel",
      "stainless_steel": "stainless steel",
      "alloy_steel": "alloy steel",
      "pig_iron": "pig iron",
      "dri": "direct reduced iron",
      "billet": "steel billet",
      "bloom": "steel bloom",
      "slab": "steel slab",
      "steel_scrap": "steel scrap",
      "ferro_alloy": "ferro alloy",
      "limestone": "limestone",
      "dolomite": "dolomite",
      "coke": "coke",
      "iron_ore": "iron ore"
    };
    const searchCategory = CLIMATIQ_CATEGORY_MAPPING[input.category] || input.category;
    const searchQuery = `${searchCategory} ${cleanItemName}`;
    const genericQuery = `${searchCategory}`;

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

  // Helper: try Climatiq estimate with automatic unit-type retry (Mapped Path)
  const tryClimatiqWithRetryMapped = async (actId: string, region: string | undefined, converted: any) => {
    const baseParams = {
      [converted.parameterName]: converted.value,
      ...(converted.parameterUnit ? { [`${converted.parameterName}_unit`]: converted.parameterUnit } : {}),
      ...((converted as any).extraParameterName ? {
        [(converted as any).extraParameterName]: (converted as any).extraParameterValue,
        ...((converted as any).extraParameterUnit ? { [`${(converted as any).extraParameterName}_unit`]: (converted as any).extraParameterUnit } : {})
      } : {}),
    };

    const paramVariants = [
      baseParams,
      // Retry 1: weight -> mass
      ...(converted.parameterName === "weight" ? [{ ...baseParams, weight: undefined, weight_unit: undefined, mass: converted.value, mass_unit: converted.parameterUnit || "kg" }] : []),
      // Retry 2: mass -> weight
      ...(converted.parameterName === "mass" ? [{ ...baseParams, mass: undefined, mass_unit: undefined, weight: converted.value, weight_unit: converted.parameterUnit || "kg" }] : []),
      // Retry 3: weight/kg -> weight/t
      ...(converted.parameterName === "weight" && converted.parameterUnit === "kg" ? [{ ...baseParams, weight: Number((converted.value / 1000).toFixed(6)), weight_unit: "t" }] : []),
      // Retry 4: weight/t -> weight/kg
      ...(converted.parameterName === "weight" && (converted.parameterUnit === "t" || converted.parameterUnit === "tonne") ? [{ ...baseParams, weight: converted.value * 1000, weight_unit: "kg" }] : []),
    ];

    for (let attempt = 0; attempt < paramVariants.length; attempt++) {
      try {
        const params = paramVariants[attempt];
        // Remove undefined values
        Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
        
        if (attempt > 0) {
          console.log(`[Climatiq Retry ${attempt}] Trying alternate params:`, params);
        }
        const result = await estimateWithClimatiq({
          selectedEF: { activity_id: actId, ...(region ? { region } : {}) },
          parameters: params,
        });
        return { result, usedParams: params };
      } catch (err: any) {
        const errCode = err?.response?.data?.error_code || "";
        const errMsg = String(err?.response?.data?.message || err?.message || "");
        const isUnitError = errCode === "no_compatible_unit_types" || errCode === "parameters_incorrect" || errMsg.includes("compatible") || errMsg.includes("unit_type") || errMsg.includes("parameters") || errMsg.includes("incorrect");
        
        // If region specific factor not found, try without region (Global fallback)
        if (region && errCode === 'no_emission_factors_found') {
          console.log(`\nRegion specific factor not found for ${region}. Retrying without region...`);
          try {
             const result = await estimateWithClimatiq({
               selectedEF: { activity_id: actId },
               parameters: paramVariants[attempt],
             });
             return { result, usedParams: paramVariants[attempt] };
          } catch (fallbackError: any) {
              const fallbackErrCode = fallbackError?.response?.data?.error_code || "";
              const fallbackErrMsg = String(fallbackError?.response?.data?.message || fallbackError?.message || "");
              const isFallbackUnitError = fallbackErrCode === "no_compatible_unit_types" || fallbackErrCode === "parameters_incorrect" || fallbackErrMsg.includes("compatible") || fallbackErrMsg.includes("unit_type") || fallbackErrMsg.includes("parameters") || fallbackErrMsg.includes("incorrect");
              
              if (!isFallbackUnitError || attempt === paramVariants.length - 1) throw fallbackError;
              continue;
          }
        }

        if (!isUnitError || attempt === paramVariants.length - 1) throw err;
      }
    }
    throw new Error("All Climatiq parameter variants exhausted");
  };

  try {
    const { result: climatiqResult } = await tryClimatiqWithRetryMapped(activityId, climatiqRegion, converted);
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
