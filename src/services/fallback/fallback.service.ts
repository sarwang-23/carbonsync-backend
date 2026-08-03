import { pool } from "../../db.js";
import { normalizeUnit } from "../UnitConversion.service.js";

// ═══════════════════════════════════════════════════════════════════════════
// Industry-specific master alias mapping
// Alias (lowercase) → canonical category used in emission_factor_mappings / Climatiq
// ═══════════════════════════════════════════════════════════════════════════
const CATEGORY_ALIASES: Record<string, string> = {
  // ── Iron Ore ─────────────────────────────────────────────────────────────
  "iron ore": "iron_ore",
  "iron ore fines": "iron_ore",
  "iron ore lumps": "iron_ore",
  "iron ore pellets": "iron_ore",
  "iron ore concentrate": "iron_ore",
  "sinter feed": "iron_ore",
  "pellet feed": "iron_ore",
  "magnetite": "iron_ore",
  "hematite": "iron_ore",
  "beneficiated ore": "iron_ore",
  "iron concentrate": "iron_ore",

  // ── Coal ─────────────────────────────────────────────────────────────────
  "coal": "coal",
  "steam coal": "coal",
  "thermal coal": "coal",
  "coking coal": "coal",
  "metallurgical coal": "coal",
  "pci coal": "coal",
  "pulverized coal": "coal",
  "anthracite": "coal",
  "bituminous coal": "coal",
  "sub-bituminous coal": "coal",
  "lignite": "coal",
  "brown coal": "coal",
  "coal fines": "coal",

  // ── Coke ─────────────────────────────────────────────────────────────────
  "coke": "coke",
  "coke breeze": "coke",
  "metallurgical coke": "coke",
  "met coke": "coke",
  "nut coke": "coke",
  "coke nut": "coke",
  "foundry coke": "coke",
  "blast furnace coke": "coke",
  "bf coke": "coke",
  "coke fines": "coke",
  "green coke": "coke",
  "calcined coke": "coke",
  "pet coke": "coke",
  "petroleum coke": "coke",
  "petcoke": "coke",

  // ── Limestone ────────────────────────────────────────────────────────────
  "limestone": "limestone",
  "limestone chips": "limestone",
  "limestone powder": "limestone",
  "dolomite limestone": "limestone",
  "calcite": "limestone",
  "lime stone": "limestone",
  "crushed limestone": "limestone",
  "high calcium limestone": "limestone",
  "flux limestone": "limestone",

  // ── Dolomite ─────────────────────────────────────────────────────────────
  "dolomite": "dolomite",
  "dolomite chips": "dolomite",
  "dolomite powder": "dolomite",
  "raw dolomite": "dolomite",
  "burnt dolomite": "dolomite",
  "calcined dolomite": "dolomite",

  // ── Lime ─────────────────────────────────────────────────────────────────
  "quick lime": "lime",
  "quicklime": "lime",
  "hydrated lime": "lime",
  "burnt lime": "lime",
  "calcined lime": "lime",
  "cao": "lime",

  // ── Ferro Alloys ─────────────────────────────────────────────────────────
  "ferro silicon": "ferro_alloy",
  "ferrosilicon": "ferro_alloy",
  "fesi": "ferro_alloy",
  "fe-si": "ferro_alloy",
  "ferro manganese": "ferro_alloy",
  "ferromanganese": "ferro_alloy",
  "femn": "ferro_alloy",
  "fe-mn": "ferro_alloy",
  "silico manganese": "ferro_alloy",
  "silicomanganese": "ferro_alloy",
  "simn": "ferro_alloy",
  "ferro chrome": "ferro_alloy",
  "ferrochrome": "ferro_alloy",
  "fecr": "ferro_alloy",
  "fe-cr": "ferro_alloy",
  "low carbon ferro chrome": "ferro_alloy",
  "high carbon ferro chrome": "ferro_alloy",
  "ferro nickel": "ferro_alloy",
  "ferro vanadium": "ferro_alloy",
  "ferro titanium": "ferro_alloy",
  "ferro boron": "ferro_alloy",
  "ferro phosphorus": "ferro_alloy",
  "ferro molybdenum": "ferro_alloy",
  "ferro tungsten": "ferro_alloy",
  "ferro niobium": "ferro_alloy",
  "ferro zirconium": "ferro_alloy",
  "ferro aluminium": "ferro_alloy",
  "ferro cobalt": "ferro_alloy",
  "ferro alloy": "ferro_alloy",
  "ferroalloy": "ferro_alloy",

  // ── Scrap ────────────────────────────────────────────────────────────────
  "steel scrap": "steel_scrap",
  "ms scrap": "steel_scrap",
  "heavy melting scrap": "steel_scrap",
  "hms": "steel_scrap",
  "hms scrap": "steel_scrap",
  "shredded scrap": "steel_scrap",
  "plate scrap": "steel_scrap",
  "turnings": "steel_scrap",
  "busheling": "steel_scrap",
  "pig iron scrap": "steel_scrap",
  "iron scrap": "steel_scrap",
  "cast iron scrap": "steel_scrap",
  "recycled steel": "steel_scrap",
  "scrap metal": "steel_scrap",
  "metal scrap": "steel_scrap",

  // ── Pig Iron ─────────────────────────────────────────────────────────────
  "pig iron": "pig_iron",
  "basic pig iron": "pig_iron",
  "foundry pig iron": "pig_iron",
  "steel grade pig iron": "pig_iron",

  // ── Direct Reduced Iron ──────────────────────────────────────────────────
  "dri": "dri",
  "sponge iron": "dri",
  "hot briquetted iron": "dri",
  "hbi": "dri",
  "cold dri": "dri",
  "direct reduced iron": "dri",

  // ── Billets ──────────────────────────────────────────────────────────────
  "billet": "billet",
  "steel billet": "billet",
  "ms billet": "billet",
  "alloy billet": "billet",
  "square billet": "billet",

  // ── Blooms ───────────────────────────────────────────────────────────────
  "bloom": "bloom",
  "steel bloom": "bloom",

  // ── Slabs ────────────────────────────────────────────────────────────────
  "slab": "slab",
  "steel slab": "slab",
  "hot slab": "slab",

  // ── Finished Steel ───────────────────────────────────────────────────────
  "steel coil": "finished_steel",
  "hot rolled coil": "finished_steel",
  "cold rolled coil": "finished_steel",
  "crc": "finished_steel",
  "hrc": "finished_steel",
  "steel plate": "finished_steel",
  "steel sheet": "finished_steel",
  "steel bar": "finished_steel",
  "steel rod": "finished_steel",
  "wire rod": "finished_steel",
  "steel pipe": "finished_steel",
  "steel tube": "finished_steel",
  "steel beam": "finished_steel",
  "steel rail": "finished_steel",
  "steel section": "finished_steel",
  "rebar": "finished_steel",
  "tmt bar": "finished_steel",
  "angle": "finished_steel",
  "channel": "finished_steel",
  "flat steel": "finished_steel",
  "structural steel": "finished_steel",

  // ── Stainless Steel ──────────────────────────────────────────────────────
  "stainless steel": "stainless_steel",
  "ss coil": "stainless_steel",
  "ss sheet": "stainless_steel",
  "ss pipe": "stainless_steel",
  "ss plate": "stainless_steel",
  "ss scrap": "stainless_steel",

  // ── Alloy Steel ──────────────────────────────────────────────────────────
  "alloy steel": "alloy_steel",
  "carbon steel": "alloy_steel",
  "tool steel": "alloy_steel",
  "spring steel": "alloy_steel",
  "bearing steel": "alloy_steel",
  "electrical steel": "alloy_steel",
  "silicon steel": "alloy_steel",

  // ── Refractories ─────────────────────────────────────────────────────────
  "refractory": "refractory",
  "fire brick": "refractory",
  "magnesia brick": "refractory",
  "alumina brick": "refractory",
  "graphite electrode": "refractory",
  "carbon brick": "refractory",
  "ceramic lining": "refractory",

  // ── Flux ─────────────────────────────────────────────────────────────────
  "flux": "flux",
  "flux material": "flux",
  "bf flux": "flux",
  "bof flux": "flux",
  "sinter flux": "flux",
  "basic flux": "flux",

  // ── Gases ────────────────────────────────────────────────────────────────
  "oxygen": "industrial_gas",
  "liquid oxygen": "industrial_gas",
  "nitrogen": "industrial_gas",
  "liquid nitrogen": "industrial_gas",
  "argon": "industrial_gas",
  "liquid argon": "industrial_gas",
  "hydrogen": "industrial_gas",
  "acetylene": "industrial_gas",
  "compressed air": "industrial_gas",
  "industrial gas": "industrial_gas",

  // ── Industrial Chemicals ─────────────────────────────────────────────────
  "sulphuric acid": "chemicals",
  "hydrochloric acid": "chemicals",
  "caustic soda": "chemicals",
  "sodium hydroxide": "chemicals",
  "ammonia": "chemicals",
  "carbon powder": "chemicals",
  "binder": "chemicals",
  "lubricant": "chemicals",
  "resin": "chemicals",
  "flux oil": "chemicals",

  // ── Fuel ─────────────────────────────────────────────────────────────────
  "natural gas": "natural_gas",
  "lng": "natural_gas",
  "lpg": "lpg",
  "furnace oil": "fuel",
  "diesel": "fuel",
  "premium diesel": "fuel",
  "high speed diesel": "fuel",
  "hsd": "fuel",
  "ulsd": "fuel",
  "ultra low sulfur diesel": "fuel",
  "gasoil": "fuel",
  "gas oil": "fuel",
  "petrol": "petrol",
  "heavy fuel oil": "fuel",
  "light diesel oil": "fuel",
  "fo": "fuel",
  "biofuel": "fuel",
  "motor spirit": "petrol",
  "petrol 91": "petrol",
  "petrol 95": "petrol",
  "ron 91": "petrol",
  "ron 95": "petrol",
  "industrial lpg cylinder": "lpg",

  // ── Electricity ──────────────────────────────────────────────────────────
  "electricity": "electricity",
  "power": "electricity",
  "grid electricity": "electricity",
  "purchased electricity": "electricity",
  "renewable electricity": "electricity",
  "solar power": "electricity",
  "wind power": "electricity",
  "vic electricity": "electricity",
  "nsw grid": "electricity",
  "victoria grid": "electricity",

  // ── Water ────────────────────────────────────────────────────────────────
  "industrial water": "water",
  "raw water": "water",
  "process water": "water",
  "dm water": "water",
  "soft water": "water",
  "cooling water": "water",
  "water": "water",

  // ── Transport ────────────────────────────────────────────────────────────
  "truck transport": "transport",
  "rail transport": "transport",
  "sea freight": "transport",
  "ocean freight": "transport",
  "container": "transport",
  "bulk carrier": "transport",
  "barge": "transport",
  "air freight": "transport",
  "freight": "transport",

  // ── By-products ──────────────────────────────────────────────────────────
  "slag": "byproduct",
  "blast furnace slag": "byproduct",
  "bof slag": "byproduct",
  "steel slag": "byproduct",
  "mill scale": "byproduct",
  "fly ash": "byproduct",
  "dust": "byproduct",
  "ash": "byproduct",
  "waste heat": "byproduct",
  "tar": "byproduct",
  "benzol": "byproduct",
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

  let fuzzyResult;
  try {
    fuzzyResult = await pool.query(fuzzyQuery, [input.region, resolvedCategory !== "unknown" ? resolvedCategory : normalizedItemName]);
  } catch (err: any) {
    console.warn(`[FallbackLookup] DB Error:`, err.message);
    return null;
  }
  
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
