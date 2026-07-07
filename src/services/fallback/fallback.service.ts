import { pool } from "../../db.js";
import { normalizeUnit } from "../UnitConversion.service.js";

const CATEGORY_ALIASES: Record<string, string> = {
  "premium diesel": "diesel",
  "hsd": "diesel",
  "high speed diesel": "diesel",
  "ulsd": "diesel",
  "motor spirit": "petrol",
  "gasoline": "petrol",
  "petrol 91": "petrol",
  "petrol 95": "petrol",
  "vic electricity": "electricity",
  "nsw grid": "electricity",
  "industrial lpg cylinder": "lpg",
};

export async function fallbackLookup(input: {
  region: string;
  countryName: string;
  category: string;
  itemName: string;
  value: number;
  unit: string;
}) {
  const normalizedItemName = input.itemName.toLowerCase().trim();
  let resolvedCategory = input.category;

  // 1. Alias Mapping Check
  for (const [alias, actual] of Object.entries(CATEGORY_ALIASES)) {
    if (normalizedItemName.includes(alias) || input.category.toLowerCase() === alias) {
      resolvedCategory = actual;
      console.log(`[Fallback] Alias matched: "${alias}" -> "${actual}"`);
      break;
    }
  }

  const normalizedInputUnit = normalizeUnit(input.unit);

  // 2. Fuzzy Search using pg_trgm on official_emission_factors
  const fuzzyQuery = `
    SELECT
      factor_id,
      activity_id,
      name,
      category,
      region,
      source,
      source_dataset,
      unit,
      factor,
      similarity(lower(name), lower($2)) as sim_score
    FROM official_emission_factors
    WHERE region = $1
      AND is_active = true
      AND factor is not null
    ORDER BY sim_score DESC
    LIMIT 5;
  `;

  const fuzzyResult = await pool.query(fuzzyQuery, [input.region, resolvedCategory !== "unknown" ? resolvedCategory : normalizedItemName]);
  
  if (fuzzyResult.rows.length > 0) {
    const bestMatch = fuzzyResult.rows[0];
    const simScore = bestMatch.sim_score;

    console.log(`[Fallback] Fuzzy best match: "${bestMatch.name}" with score ${simScore}`);

    // Check if unit matches perfectly
    const factorActivityUnit = bestMatch.unit.includes("/") ? normalizeUnit(bestMatch.unit.split("/").pop() || "") : normalizeUnit(bestMatch.unit);
    const isUnitMatch = normalizedInputUnit === factorActivityUnit;

    let confidence = simScore;
    if (isUnitMatch) {
      confidence += 0.1; // Boost confidence if unit matches perfectly
    } else {
      confidence -= 0.3; // Penalize if units don't match, though we might still try conversion later
    }

    if (confidence > 0.85) {
      // High confidence match
      return {
        success: true,
        factor: bestMatch,
        confidence_score: confidence,
        match_type: "fuzzy_high_confidence"
      };
    } else if (confidence > 0.70) {
      return {
        success: true,
        factor: bestMatch,
        confidence_score: confidence,
        warning: "Matched with moderate confidence. Review recommended.",
        match_type: "fuzzy_moderate_confidence"
      };
    }
  }

  // 3. Country Average Fallback (Placeholder for future)
  // For now, return null to drop to Manual Review
  return null;
}
