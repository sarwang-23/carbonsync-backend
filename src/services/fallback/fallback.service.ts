import { pool } from "../../db.js";
import { normalizeUnit } from "../UnitConversion.service.js";

// ═══════════════════════════════════════════════════════════════════════════
// Industry-specific master alias mapping
// Alias (lowercase) → canonical category used in emission_factor_mappings / Climatiq
// ═══════════════════════════════════════════════════════════════════════════
const CATEGORY_ALIASES: Record<string, string> = {
  // ── Steel Industry Inputs ─────────────────────────────────────────────────
  "iron ore":                "iron_ore",
  "iron ore fines":          "iron_ore",
  "iron ore lumps":          "iron_ore",
  "iron ore pellets":        "iron_ore",
  "ore fines":               "iron_ore",
  "sinter feed":             "iron_ore",
  "pellet feed":             "iron_ore",
  "lump ore":                "iron_ore",
  "magnetite":               "iron_ore",
  "hematite":                "iron_ore",
  "pig iron":                "iron_ore",
  "sponge iron":             "iron_ore",
  "dri":                     "iron_ore",
  "direct reduced iron":     "iron_ore",
  "hbi":                     "iron_ore",
  "hot briquetted iron":     "iron_ore",

  // ── Coke & Carbon ────────────────────────────────────────────────────────
  "coke breeze":             "coal",
  "met coke":                "coal",
  "metallurgical coke":      "coal",
  "bf coke":                 "coal",
  "blast furnace coke":      "coal",
  "coke nut":                "coal",
  "pearl coke":              "coal",
  "foundry coke":            "coal",
  "petroleum coke":          "coal",
  "pet coke":                "coal",
  "petcoke":                 "coal",
  "coking coal":             "coal",
  "thermal coal":            "coal",
  "steam coal":              "coal",

  // ── Ferro Alloys ─────────────────────────────────────────────────────────
  "ferro silicon":           "ferro_alloy",
  "ferrosilicon":            "ferro_alloy",
  "fe-si":                   "ferro_alloy",
  "fesi":                    "ferro_alloy",
  "ferro silicon 70%":       "ferro_alloy",
  "ferro silicon (70%)":     "ferro_alloy",
  "ferro manganese":         "ferro_alloy",
  "ferromanganese":          "ferro_alloy",
  "fe-mn":                   "ferro_alloy",
  "femn":                    "ferro_alloy",
  "silico manganese":        "ferro_alloy",
  "silicomanganese":         "ferro_alloy",
  "simn":                    "ferro_alloy",
  "ferro chrome":            "ferro_alloy",
  "ferrochrome":             "ferro_alloy",
  "fe-cr":                   "ferro_alloy",
  "fecr":                    "ferro_alloy",
  "ferro alloy":             "ferro_alloy",
  "ferroalloy":              "ferro_alloy",
  "ferro titanium":          "ferro_alloy",
  "ferro molybdenum":        "ferro_alloy",
  "ferro vanadium":          "ferro_alloy",

  // ── Limestone & Minerals ─────────────────────────────────────────────────
  "limestone":               "limestone",
  "lime stone":              "limestone",
  "dolomite":                "limestone",
  "quick lime":              "limestone",
  "quicklime":               "limestone",
  "hydrated lime":           "limestone",
  "calcined lime":           "limestone",
  "burnt lime":              "limestone",
  "calcium carbonate":       "limestone",
  "calcium oxide":           "limestone",
  "flux stone":              "limestone",

  // ── Scrap Metal ──────────────────────────────────────────────────────────
  "steel scrap":             "scrap_metal",
  "iron scrap":              "scrap_metal",
  "metal scrap":             "scrap_metal",
  "ms scrap":                "scrap_metal",
  "hms scrap":               "scrap_metal",
  "heavy melting scrap":     "scrap_metal",
  "shredded scrap":          "scrap_metal",
  "scrap metal":             "scrap_metal",

  // ── Aggregates & Quarried ─────────────────────────────────────────────────
  "silica sand":             "aggregates",
  "quartz sand":             "aggregates",
  "river sand":              "aggregates",
  "m-sand":                  "aggregates",
  "crushed stone":           "aggregates",
  "granite aggregate":       "aggregates",
  "aggregates":              "aggregates",
  "gravel":                  "aggregates",

  // ── Fuel Aliases ─────────────────────────────────────────────────────────
  "premium diesel":          "diesel",
  "high speed diesel":       "diesel",
  "hsd":                     "diesel",
  "ulsd":                    "diesel",
  "ultra low sulfur diesel": "diesel",
  "gasoil":                  "diesel",
  "gas oil":                 "diesel",
  "motor spirit":            "petrol",
  "petrol 91":               "petrol",
  "petrol 95":               "petrol",
  "ron 91":                  "petrol",
  "ron 95":                  "petrol",
  "industrial lpg cylinder": "lpg",

  // ── Electricity Aliases ───────────────────────────────────────────────────
  "vic electricity":         "electricity",
  "nsw grid":                "electricity",
  "victoria grid":           "electricity",
  "grid electricity":        "electricity",
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
