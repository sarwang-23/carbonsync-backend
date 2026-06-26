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

    if (!selectedEF?.region) {
        throw new Error("Selected emission factor region is missing");
    }

    return {
        emission_factor: {
            activity_id: selectedEF.activity_id,
            region: selectedEF.region,
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
 * Converts normalized item/category into Climatiq parameters.
 */
export function buildActivityParameters(category: string, item: any, converted?: any) {
    const unit = safeLower(item?.unit);

    if (category === "electricity_bill") {
        return {
            energy: Number(converted?.value || item?.quantity || item?.parameters?.energy || item?.parameters?.energy_kwh || 0),
            energy_unit: "kWh",
        };
    }

    if (category === "fuel") {
        return {
            volume: Number(item?.quantity || converted?.value || 0),
            volume_unit: unit.includes("lit") || unit === "l" || unit === "ltr" ? "l" : item?.unit || "l",
        };
    }

    if (category === "transport_logistics") {
        return {
            weight: Number(item?.weight || item?.parameters?.weight || item?.quantity || 1),
            weight_unit: item?.weight_unit || item?.parameters?.weight_unit || "t",
            distance: Number(item?.distance || item?.parameters?.distance || 1),
            distance_unit: item?.distance_unit || item?.parameters?.distance_unit || "km",
        };
    }

    if (category === "purchased_goods" || category === "waste") {
        return {
            weight: Number(converted?.value || item?.quantity || 0),
            weight_unit: converted?.unit || "kg",
        };
    }

    if (category === "water") {
        return {
            volume: Number(item?.quantity || converted?.value || 0),
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

