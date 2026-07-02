import axios from "axios";

export type SupportedCountry = "IN" | "MY";

const SEARCH_URL = "https://api.climatiq.io/data/v1/search";
const ESTIMATE_URL = "https://api.climatiq.io/data/v1/estimate";

function getClimatiqApiKey() {
    const apiKey = process.env.CLIMATIQ_API_KEY;
    if (!apiKey) {
        throw new Error("CLIMATIQ_API_KEY is missing");
    }
    return apiKey;
}

export function getClimatiqDataVersion() {
    return process.env.CLIMATIQ_DATA_VERSION || "^21";
}

function safeLower(value: any) {
    return String(value || "").toLowerCase();
}

export interface ClimatiqSearchInput {
    query: string;
    region: SupportedCountry | string;
    category?: string;
    resultsPerPage?: number;
}

export interface ClimatiqEstimateInput {
    selectedEF: any;
    parameters: Record<string, any>;
}

/**
 * Calls Climatiq Search API.
 * Search API returns metadata/factors list, not final CO2e.
 */
export async function searchClimatiqEmissionFactors(input: ClimatiqSearchInput) {
    const apiKey = getClimatiqApiKey();
    const dataVersion = getClimatiqDataVersion();

    console.log("CLIMATIQ_SEARCH_STARTED", {
        query: input.query,
        region: input.region,
        category: input.category || null,
        dataVersion,
        resultsPerPage: input.resultsPerPage || 50,
    });

    const response = await axios.get(SEARCH_URL, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
        params: {
            query: input.query,
            region: input.region,
            data_version: dataVersion,
            ...(input.category ? { category: input.category } : {}),
            results_per_page: input.resultsPerPage || 50,
        },
    });

    const results = response.data?.results || [];

    console.log("CLIMATIQ_SEARCH_SUCCESS", {
        query: input.query,
        region: input.region,
        result_count: results.length,
        first_result: results[0]
            ? {
                  activity_id: results[0].activity_id,
                  source: results[0].source,
                  year: results[0].year,
                  region: results[0].region,
                  unit: results[0].unit,
              }
            : null,
    });

    return response.data;
}

/**
 * Builds Climatiq Estimate API payload.
 * Actual CO2e result comes from Estimate API.
 */
export function buildClimatiqEstimatePayload(input: ClimatiqEstimateInput) {
    const dataVersion = getClimatiqDataVersion();
    const selectedEF = input.selectedEF;

    if (!selectedEF?.activity_id) {
        throw new Error("Selected emission factor activity_id is missing");
    }

    return {
        emission_factor: {
            activity_id: selectedEF.activity_id,
            ...(selectedEF.region ? { region: selectedEF.region } : {}),
            year: selectedEF.year,
            data_version: dataVersion,
        },
        parameters: input.parameters,
    };
}

/**
 * Calls Climatiq Estimate API.
 */
export async function estimateWithClimatiq(input: ClimatiqEstimateInput) {
    const apiKey = getClimatiqApiKey();
    const payload = buildClimatiqEstimatePayload(input);

    console.log("CLIMATIQ_ESTIMATE_STARTED", {
        activity_id: payload.emission_factor.activity_id,
        region: payload.emission_factor.region,
        year: payload.emission_factor.year,
        parameters: payload.parameters,
    });

    try {
        const response = await axios.post(ESTIMATE_URL, payload, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
        });

        console.log("CLIMATIQ_ESTIMATE_SUCCESS", {
            co2e: response.data?.co2e,
            co2e_unit: response.data?.co2e_unit,
            source: response.data?.emission_factor?.source,
            year: response.data?.emission_factor?.year,
            region: response.data?.emission_factor?.region,
        });

        return {
            climatiqBody: payload,
            data: response.data,
        };
    } catch (error: any) {
        console.warn("CLIMATIQ_ESTIMATE_FAILED", {
            status: error?.response?.status,
            response: error?.response?.data,
            activity_id: payload.emission_factor.activity_id,
            parameters: payload.parameters,
        });
        throw error;
    }
}

/**
 * Strict selector for electricity bills.
 * For Malaysia electricity bills, latest Ember production mix should win.
 */
export function selectLatestEmberElectricityFactor(results: any[], region: string) {
    return (results || [])
        .filter((r) => {
            const activityId = safeLower(r.activity_id);
            const unit = safeLower(r.unit);

            return (
                r.region === region &&
                r.source === "Ember" &&
                activityId.includes("electricity-supply_grid-source_production_mix") &&
                unit.includes("kwh")
            );
        })
        .sort((a, b) => Number(b.year || 0) - Number(a.year || 0))[0] || null;
}

/**
 * Checks if Climatiq factor metadata looks compatible with a parameter style.
 * This is a best-effort guard before hitting Estimate API.
 */
export function isLikelyCompatibleFactor(selectedEF: any, parameters: Record<string, any>) {
    const unit = safeLower(selectedEF?.unit);
    const activity = safeLower(`${selectedEF?.activity_id || ""} ${selectedEF?.name || ""} ${selectedEF?.description || ""}`);

    const isSpendFactor =
        unit.includes("/usd") ||
        unit.includes("usd") ||
        unit.includes("/eur") ||
        unit.includes("eur") ||
        unit.includes("/gbp") ||
        unit.includes("gbp");

    // Example: CEDA "kg/usd" factors must receive money parameters, not weight.
    if (isSpendFactor) {
        return parameters.money !== undefined;
    }

    if (parameters.energy !== undefined) {
        return (
            unit.includes("kwh") || 
            unit.includes("gj") || 
            unit.includes("mj") || 
            activity.includes("electricity") || 
            activity.includes("gas") || 
            activity.includes("fuel")
        );
    }

    if (parameters.weight !== undefined) {
        return (
            unit === "kg/kg" ||
            unit === "kg/t" ||
            unit.includes("kg/tonne") ||
            unit.includes("kg/t") ||
            unit.includes("tonne") ||
            activity.includes("production") ||
            activity.includes("material")
        );
    }

    if (parameters.volume !== undefined) {
        return unit.includes("l") || unit.includes("m3") || activity.includes("water") || activity.includes("fuel");
    }

    if (parameters.money !== undefined) {
        return isSpendFactor || unit.includes("money");
    }

    if (parameters.number !== undefined) {
        return unit.includes("number") || unit.includes("unit") || activity.includes("hotel");
    }

    return true;
}

/**
 * Converts normalized item/category into Climatiq parameters.
 * Do not send unsupported internal units such as m2 directly to Climatiq for purchased goods.
 */
export function buildActivityParameters(category: string, item: any, converted?: any) {
    const unit = safeLower(item?.unit || converted?.unit);

    if (category === "electricity_bill") {
        return {
            energy: Number(converted?.value || item?.quantity || item?.parameters?.energy || item?.parameters?.energy_kwh || 0),
            energy_unit: "kWh",
        };
    }

    if (category === "fuel" || category === "diesel" || category === "petrol") {
        return {
            volume: Number(converted?.value || item?.quantity || 0),
            volume_unit: unit.includes("lit") || unit === "l" || unit === "ltr" ? "l" : item?.unit || "l",
        };
    }

    if (category === "natural_gas" || category === "lpg") {
        let gasUnit = unit;
        if (unit.includes("gj")) gasUnit = "gj";
        else if (unit.includes("mj")) gasUnit = "mj";
        else if (unit.includes("kg")) gasUnit = "kg";
        else if (unit.includes("m3") || unit.includes("cubic")) gasUnit = "m3";
        else gasUnit = "m3"; // fallback

        // Climatiq sometimes uses energy parameters for gas (GJ, MJ), or volume (m3), or weight (kg for LPG)
        if (gasUnit === "gj" || gasUnit === "mj") {
            return {
                energy: Number(converted?.value || item?.quantity || 0),
                energy_unit: gasUnit,
            };
        }
        if (gasUnit === "kg") {
            return {
                weight: Number(converted?.value || item?.quantity || 0),
                weight_unit: gasUnit,
            };
        }
        return {
            volume: Number(converted?.value || item?.quantity || 0),
            volume_unit: gasUnit,
        };
    }

    if (category === "transport_logistics") {
        return {
            weight: Number(item?.weight || item?.parameters?.weight || converted?.weight || item?.quantity || 1),
            weight_unit: item?.weight_unit || item?.parameters?.weight_unit || converted?.weight_unit || "t",
            distance: Number(item?.distance || item?.parameters?.distance || 1),
            distance_unit: item?.distance_unit || item?.parameters?.distance_unit || "km",
        };
    }

    if (category === "purchased_goods" || category === "waste") {
        if (converted?.unit === "kg" || converted?.weight_unit === "kg") {
            return {
                weight: Number(converted?.value || converted?.weight || item?.quantity || 0),
                weight_unit: "kg",
            };
        }

        if (converted?.unit === "t" || converted?.unit === "tonne" || converted?.weight_unit === "t") {
            return {
                weight: Number(converted?.value || converted?.weight || item?.quantity || 0),
                weight_unit: "t",
            };
        }

        if (unit === "kg") {
            return {
                weight: Number(item?.quantity || 0),
                weight_unit: "kg",
            };
        }

        if (unit === "t" || unit === "tonne" || unit === "mt") {
            return {
                weight: Number(item?.quantity || 0),
                weight_unit: "t",
            };
        }

        // If only spend is available, let Climatiq spend-based factor work when compatible.
        if (item?.amount && item?.currency) {
            return {
                money: Number(item.amount),
                money_unit: item.currency,
            };
        }

        return {
            weight: Number(converted?.value || item?.quantity || 0),
            weight_unit: converted?.unit || "kg",
        };
    }

    if (category === "water") {
        return {
            volume: Number(converted?.value || item?.quantity || 0),
            volume_unit: unit === "m3" ? "m3" : item?.unit || "m3",
        };
    }

    if (category === "hotel") {
        return {
            number: Number(item?.quantity || 1),
        };
    }

    throw new Error(`Unsupported Climatiq activity parameter category: ${category}`);
}

type ClimatiqEstimateDirectInput = {
  activityId: string;
  parameterName: string;
  value: number;
  parameterUnit?: string;
  dataVersion?: string;
  region?: string;
  parameters?: any;
};

type ClimatiqEstimateDirectResult = {
  success: boolean;
  co2e: number;
  co2e_unit: string;
  activity_id: string;
  factor_name?: string;
  factor_source?: string;
  factor_region?: string;
  raw?: any;
};

export async function estimateWithClimatiqDirect(
  input: ClimatiqEstimateDirectInput
): Promise<ClimatiqEstimateDirectResult> {
  const apiKey = getClimatiqApiKey();
  const CLIMATIQ_BASE_URL = "https://api.climatiq.io/data/v1";

  if (!input.activityId) throw new Error("Climatiq activityId is required");
  if (!input.parameterName) throw new Error("Climatiq parameterName is required");
  if (!Number.isFinite(input.value) || input.value <= 0) {
    throw new Error(`Invalid Climatiq value: ${input.value}`);
  }

  const body: any = {
    emission_factor: {
      activity_id: input.activityId,
      data_version: input.dataVersion || "^6",
      region: input.region,
    },
    parameters: input.parameters ? input.parameters : {
      [input.parameterName]: input.value,
    },
  };

  if (!input.parameters && input.parameterUnit) {
    body.parameters[`${input.parameterName}_unit`] = input.parameterUnit;
  }

  const response = await fetch(`${CLIMATIQ_BASE_URL}/estimate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Climatiq API failed with status ${response.status}`);
  }

  return {
    success: true,
    co2e: Number(data.co2e || 0),
    co2e_unit: data.co2e_unit || "kg",
    activity_id: input.activityId,
    factor_name: data.emission_factor?.name,
    factor_source: data.emission_factor?.source,
    factor_region: data.emission_factor?.region,
    raw: data,
  };
}
