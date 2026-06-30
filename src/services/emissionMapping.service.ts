export type SupportedCountry = "IN" | "MY";

export type MappingCategory =
    | "electricity_bill"
    | "train_ticket"
    | "flight_ticket"
    | "fuel"
    | "transport_logistics"
    | "purchased_goods"
    | "water"
    | "waste"
    | "hotel"
    | "unknown";

export interface EmissionMappingDecision {
    success: boolean;
    mapping_type:
        | "fixed_india_electricity"
        | "fixed_india_train"
        | "fixed_india_flight"
        | "climatiq_latest_ember_electricity"
        | "climatiq_dynamic"
        | "needs_review";
    country: SupportedCountry | string;
    category: MappingCategory;
    confidence: number;
    reason: string;
    warnings: string[];
    selected_emission_factor?: any;
    alternatives?: any[];
    audit: Record<string, any>;
}

function safeLower(value: any) {
    return String(value || "").toLowerCase();
}

function scoreYear(year: any) {
    const y = Number(year || 0);
    if (y >= 2024) return 80;
    if (y >= 2023) return 65;
    if (y >= 2022) return 50;
    if (y >= 2020) return 30;
    if (y > 0 && y < 2020) return -40;
    return 0;
}

/**
 * Hard policy decision before Climatiq search.
 * India electricity/train/flight should use fixed EF, not Climatiq.
 */
export function getPreMappingPolicy(input: {
    country: SupportedCountry | string;
    category: MappingCategory;
}): EmissionMappingDecision | null {
    if (input.country === "IN" && input.category === "electricity_bill") {
        return {
            success: true,
            mapping_type: "fixed_india_electricity",
            country: "IN",
            category: "electricity_bill",
            confidence: 0.98,
            reason: "India electricity bill uses configured fixed EF 0.710 kgCO2e/kWh.",
            warnings: [],
            audit: {
                policy: "IN_ELECTRICITY_FIXED_EF",
                climatiq_required: false,
            },
        };
    }

    if (input.country === "IN" && input.category === "train_ticket") {
        return {
            success: true,
            mapping_type: "fixed_india_train",
            country: "IN",
            category: "train_ticket",
            confidence: 0.98,
            reason: "India train ticket uses configured fixed EF 0.007976 kgCO2e/passenger-km.",
            warnings: [],
            audit: {
                policy: "IN_TRAIN_FIXED_EF",
                climatiq_required: false,
            },
        };
    }

    if (input.country === "IN" && input.category === "flight_ticket") {
        return {
            success: true,
            mapping_type: "fixed_india_flight",
            country: "IN",
            category: "flight_ticket",
            confidence: 0.98,
            reason: "India flight ticket uses configured fixed EF 0.18 kgCO2e/passenger-km.",
            warnings: [],
            audit: {
                policy: "IN_FLIGHT_FIXED_EF",
                climatiq_required: false,
            },
        };
    }

    return null;
}

/**
 * Strict selector for Malaysia electricity.
 * Latest Ember production mix should win over old ADEME supplier mix.
 */
export function selectLatestElectricityFactor(results: any[], country: SupportedCountry | string) {
    const emberProductionMix = (results || [])
        .filter((r) => {
            const activityId = safeLower(r.activity_id);
            const unit = safeLower(r.unit);

            return (
                r.region === country &&
                r.source === "Ember" &&
                activityId.includes("electricity-supply_grid-source_production_mix") &&
                unit.includes("kwh")
            );
        })
        .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));

    if (emberProductionMix[0]) {
        return {
            selected: {
                ...emberProductionMix[0],
                mapping_score: 999,
            },
            alternatives: emberProductionMix.slice(1, 4),
            reason: `Selected latest ${country} Ember production mix for grid electricity.`,
            confidence: 0.96,
            mapping_type: "climatiq_latest_ember_electricity" as const,
        };
    }

    return null;
}

export function scoreClimatiqFactor(
    result: any,
    input: {
        country: SupportedCountry | string;
        category: MappingCategory;
        unit?: string;
        itemName?: string;
    }
) {
    let score = 0;

    const activity = safeLower(`${result.activity_id || ""} ${result.name || ""} ${result.description || ""}`);
    const unit = safeLower(result.unit || "");
    const sourceLca = safeLower(result.source_lca_activity || "");
    const item = safeLower(input.itemName || "");
    const inputUnit = safeLower(input.unit || "");

    if (result.region === input.country) score += 45;
    if (result.region === "GLOBAL") score += 10;
    score += scoreYear(result.year);

    if ((inputUnit === "kwh" || inputUnit.includes("kwh")) && unit.includes("kwh")) score += 25;
    if (["kg", "kgs", "ton", "tons", "tonne", "tonnes", "mt", "t"].includes(inputUnit) && (unit.includes("kg") || unit.includes("tonne") || unit.includes("t"))) score += 20;
    if (["l", "ltr", "litre", "liter", "litres", "liters"].includes(inputUnit) && (unit.includes("l") || unit.includes("litre"))) score += 20;
    if ((inputUnit === "m3" || inputUnit.includes("cubic")) && unit.includes("m3")) score += 20;

    if (input.category === "electricity_bill") {
        if (activity.includes("electricity-supply_grid")) score += 35;
        if (activity.includes("production_mix")) score += 70;
        if (activity.includes("supplier_mix")) score += 10;
        if (result.source === "Ember") score += 60;
        if (result.source === "ADEME") score += 5;
        if (result.scopes?.includes("2") || result.scopes?.includes("combined_scopes")) score += 10;
        if (activity.includes("losses")) score -= 100;
        if (sourceLca.includes("well_to_tank")) score -= 80;
        if (result.scopes?.includes("3.3")) score -= 60;
    }

    if (input.category === "fuel") {
        if (activity.includes("fuel")) score += 25;
        if (activity.includes("combustion")) score += 30;
        if (item.includes("diesel") && activity.includes("diesel")) score += 35;
        if ((item.includes("petrol") || item.includes("gasoline")) && (activity.includes("petrol") || activity.includes("gasoline"))) score += 35;
        if (activity.includes("freight")) score -= 35;
    }

    if (input.category === "transport_logistics") {
        if (activity.includes("freight")) score += 35;
        if (activity.includes("transport")) score += 25;
        if (unit.includes("tkm") || unit.includes("tonne-km")) score += 30;
        if (activity.includes("combustion") && !activity.includes("freight")) score -= 30;
    }

    if (input.category === "purchased_goods") {
        if (activity.includes("production")) score += 30;
        if (activity.includes("market for")) score += 15;

        for (const k of [
            "steel",
            "aluminium",
            "aluminum",
            "cement",
            "timber",
            "wood",
            "plywood",
            "textile",
            "fabric",
            "plastic",
            "paper",
        ]) {
            if (item.includes(k) && activity.includes(k)) score += 35;
        }

        if (activity.includes("transport")) score -= 30;
        if (activity.includes("waste")) score -= 30;
    }

    if (input.category === "water") {
        if (activity.includes("water supply")) score += 40;
        if (activity.includes("water treatment")) score += 20;
        if (unit.includes("m3")) score += 25;
    }

    if (input.category === "waste") {
        if (activity.includes("waste")) score += 30;
        if (activity.includes("landfill")) score += 20;
        if (activity.includes("recycling")) score += 20;
        if (activity.includes("incineration")) score += 20;
    }

    if (input.category === "hotel") {
        if (activity.includes("hotel")) score += 35;
        if (activity.includes("accommodation")) score += 35;
        if (activity.includes("room")) score += 15;
    }

    return score;
}

/**
 * Final Climatiq factor selector.
 * Applies strict electricity rule first, then generic scoring.
 */
export function selectBestEmissionFactorForCalculation(
    results: any[],
    input: {
        country: SupportedCountry | string;
        category: MappingCategory;
        unit?: string;
        itemName?: string;
    }
): EmissionMappingDecision {
    const warnings: string[] = [];

    if (!Array.isArray(results) || !results.length) {
        return {
            success: false,
            mapping_type: "needs_review",
            country: input.country,
            category: input.category,
            confidence: 0.2,
            reason: "No Climatiq emission factor candidates were returned.",
            warnings: ["No Climatiq search results found."],
            audit: {
                candidates_count: 0,
            },
        };
    }

    if (input.category === "electricity_bill") {
        const latestElectricity = selectLatestElectricityFactor(results, input.country);

        if (latestElectricity) {
            return {
                success: true,
                mapping_type: latestElectricity.mapping_type,
                country: input.country,
                category: input.category,
                confidence: latestElectricity.confidence,
                reason: latestElectricity.reason,
                warnings,
                selected_emission_factor: latestElectricity.selected,
                alternatives: latestElectricity.alternatives,
                audit: {
                    selector: "latest_ember_production_mix",
                    candidates_count: results.length,
                    selected_year: latestElectricity.selected.year,
                    selected_source: latestElectricity.selected.source,
                },
            };
        }

        warnings.push("Latest Ember production mix was not found. Falling back to scored Climatiq selector.");
    }

    const scored = results
        .filter((r) => r.region === input.country || r.region === "GLOBAL")
        .map((r) => ({
            ...r,
            mapping_score: scoreClimatiqFactor(r, input),
        }))
        .sort((a, b) => b.mapping_score - a.mapping_score);

    const selected = scored[0] || null;

    if (!selected) {
        return {
            success: false,
            mapping_type: "needs_review",
            country: input.country,
            category: input.category,
            confidence: 0.25,
            reason: "No suitable emission factor matched the country/category.",
            warnings: ["No candidate passed country/global filter."],
            audit: {
                candidates_count: results.length,
                scored_count: scored.length,
            },
        };
    }

    if (input.category === "electricity_bill" && Number(selected.year || 0) < 2020) {
        warnings.push(`Selected electricity EF year is ${selected.year}. Please verify because it is older than 2020.`);
    }

    const confidence =
        selected.mapping_score >= 120
            ? 0.95
            : selected.mapping_score >= 90
              ? 0.85
              : selected.mapping_score >= 60
                ? 0.7
                : 0.45;

    return {
        success: true,
        mapping_type: "climatiq_dynamic",
        country: input.country,
        category: input.category,
        confidence,
        reason: `Selected best ${input.country} emission factor using region, unit, activity, source and year scoring.`,
        warnings,
        selected_emission_factor: selected,
        alternatives: scored.filter((r) => r.id !== selected.id).slice(0, 3),
        audit: {
            selector: "generic_scored_selector",
            candidates_count: results.length,
            scored_count: scored.length,
            selected_score: selected.mapping_score,
            selected_year: selected.year,
            selected_source: selected.source,
        },
    };
}

/**
 * Helper for final response payload.
 */
export function buildSelectedEmissionFactorSummary(selected: any) {
    if (!selected) return null;

    return {
        id: selected.id,
        activity_id: selected.activity_id,
        name: selected.name,
        source: selected.source,
        source_dataset: selected.source_dataset,
        year: selected.year,
        region: selected.region,
        region_name: selected.region_name,
        unit: selected.unit,
        scope: selected.scopes,
        mapping_score: selected.mapping_score,
    };
}

import { pool } from "../db.js";

export type EmissionMapping = {
  id: number;
  region: string;
  country_name: string;
  category: string;
  keywords: string[];
  activity_id: string | null;
  preferred_source: string | null;
  preferred_lca_activity: string | null;
  parameter_name: string | null;
  parameter_unit: string | null;
  data_version: string | null;
};

export async function getEmissionMapping(
  region: string,
  category: string
): Promise<EmissionMapping | null> {
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
    where region = $1
      and category = $2
      and is_active = true
    order by id asc
    limit 1
    `,
    [region, category]
  );
  return result.rows[0] || null;
}
