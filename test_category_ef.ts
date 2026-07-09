/**
 * test_category_ef.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests all major industry categories across all supported regions.
 * Checks whether Climatiq returns a valid emission factor (EF) for each combo.
 *
 * Run:  npx tsx test_category_ef.ts
 */

import "dotenv/config";
import axios from "axios";

const ESTIMATE_URL = "https://api.climatiq.io/data/v1/estimate";
const API_KEY = process.env.CLIMATIQ_API_KEY!;
const DATA_VERSION = process.env.CLIMATIQ_DATA_VERSION || "^21";

// ─── All regions to test ────────────────────────────────────────────────────
const REGIONS = ["IN", "AU", "US", "EU", "GB", "GLO", "RoW"];

// ─── Category → representative Climatiq activity IDs (best bet first) ───────
const CATEGORY_TESTS: Record<string, string[]> = {

  // ── Steel ──────────────────────────────────────────────────────────────────
  steel: [
    "metals-type_steel_electric_arc_furnace",
    "metals-type_iron_non_alloy_steel",
  ],

  // ── Aluminium ──────────────────────────────────────────────────────────────
  aluminium: [
    "metals-type_primary_aluminium",
    "metals-type_aluminium_ingot",
  ],

  // ── Chemicals ─────────────────────────────────────────────────────────────
  chemicals: [
    "chemical_products-type_industrial_chemicals",
    "chemical_products-type_basic_chemicals",
    "chemical_products-type_chemicals",
  ],

  // ── Paper & Packaging ─────────────────────────────────────────────────────
  paper: [
    "paper_products-type_paper",
    "paper_products-type_paper_and_paperboard",
    "paper_products-type_kraft_paper",
  ],

  // ── Plastic ───────────────────────────────────────────────────────────────
  plastic: [
    "chemical_products-type_plastic_materials",
    "chemical_products-type_plastics",
    "chemical_products-type_hdpe",
  ],

  // ── Glass ─────────────────────────────────────────────────────────────────
  glass: [
    "building_materials-type_glass_flat_glass",
    "building_materials-type_flat_glass",
    "building_materials-type_glass_wool",
  ],

  // ── Cement ────────────────────────────────────────────────────────────────
  cement: [
    "building_materials-type_cement",
    "building_materials-type_portland_cement",
    "building_materials-type_concrete",
  ],

  // ── Timber / Wood ─────────────────────────────────────────────────────────
  wood: [
    "timber_forestry-type_timber_softwood",
    "timber_forestry-type_timber_hardwood",
    "timber_forestry-type_plywood_board_generic",
  ],

  // ── Textile ───────────────────────────────────────────────────────────────
  textile: [
    "textiles-type_fabric_mills",
    "textiles-type_textiles",
    "consumer_goods-type_apparel_manufacturing",
  ],

  // ── Food & Beverage ───────────────────────────────────────────────────────
  food: [
    "food_and_drink-type_food_and_drink",
    "food_and_drink-type_food",
    "food_and_drink-type_grain_crops",
  ],

  // ── Agriculture ───────────────────────────────────────────────────────────
  agriculture: [
    "agriculture-type_fertiliser",
    "agriculture-type_crop_production",
    "agriculture-type_agriculture",
  ],

  // ── Electronics ───────────────────────────────────────────────────────────
  electronics: [
    "electronics-type_electronics",
    "manufactured_goods-type_electronics",
    "manufactured_goods-type_electrical_equipment",
  ],

  // ── Electrical ────────────────────────────────────────────────────────────
  electrical: [
    "electrical_equipment-type_electrical_equipment",
    "manufactured_goods-type_electrical_equipment",
  ],

  // ── Automotive ────────────────────────────────────────────────────────────
  automotive: [
    "manufactured_goods-type_motor_vehicles",
    "manufactured_goods-type_automotive_parts",
    "manufactured_goods-type_tyres",
  ],

  // ── Construction ──────────────────────────────────────────────────────────
  construction: [
    "building_materials-type_bricks",
    "building_materials-type_ceramic_tiles",
    "building_materials-type_construction_materials",
  ],

  // ── Fuel ──────────────────────────────────────────────────────────────────
  fuel_diesel: [
    "fuels-type_diesel",
    "energy_carrier_fuels-type_diesel_average_biogenic_carbon_not_included",
  ],

  // ── Electricity ───────────────────────────────────────────────────────────
  electricity: [
    "electricity-supply_grid-source_supplier_mix",
    "electricity-energy_source_grid_mix",
  ],
};

// ─── Parameters to use per category ─────────────────────────────────────────
function getParams(category: string): Record<string, any> {
  if (["textile", "plastic", "chemicals", "electronics", "automotive", "electrical"].includes(category)) {
    return { money: 1000, money_unit: "usd" };
  }
  if (category === "electricity") {
    return { energy: 100, energy_unit: "kWh" };
  }
  if (category.startsWith("fuel")) {
    return { volume: 100, volume_unit: "l" };
  }
  // Default: weight-based
  return { weight: 1, weight_unit: "t" };
}

// ─── Single estimate call ─────────────────────────────────────────────────
async function tryEstimate(activity_id: string, region: string | undefined, params: Record<string, any>) {
  try {
    const ef: any = { activity_id, data_version: DATA_VERSION };
    if (region) ef.region = region;

    const payload = { emission_factor: ef, parameters: params };
    const res = await axios.post(ESTIMATE_URL, payload, {
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      timeout: 10000,
    });
    const co2e = res.data?.co2e;
    const unit = res.data?.co2e_unit;
    const src = res.data?.emission_factor?.source || "";
    const yr = res.data?.emission_factor?.year || "";
    return { ok: true, co2e, unit, src, yr };
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || "unknown";
    return { ok: false, error: String(msg).slice(0, 80) };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  if (!API_KEY) {
    console.error("❌  CLIMATIQ_API_KEY not set in environment.");
    process.exit(1);
  }

  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("   CLIMATIQ CATEGORY × REGION EMISSION FACTOR COVERAGE TEST");
  console.log(`   Data version: ${DATA_VERSION}   |   Regions: ${REGIONS.join(", ")}`);
  console.log("══════════════════════════════════════════════════════════════════\n");

  // Summary table
  const summary: { category: string; best_activity: string; regions_ok: string[]; regions_fail: string[] }[] = [];

  for (const [category, activityIds] of Object.entries(CATEGORY_TESTS)) {
    const params = getParams(category);
    const regions_ok: string[] = [];
    const regions_fail: string[] = [];
    let best_activity = "";

    process.stdout.write(`\n📦 ${category.padEnd(18)} `);

    for (const region of [...REGIONS, undefined as any]) {
      const regionLabel = region ?? "GLOBAL";
      let success = false;

      for (const activity_id of activityIds) {
        const result = await tryEstimate(activity_id, region, params);
        if (result.ok) {
          if (!best_activity) best_activity = activity_id;
          process.stdout.write(`✅ ${regionLabel} `);
          regions_ok.push(regionLabel);
          success = true;
          break;
        }
      }

      if (!success) {
        process.stdout.write(`❌ ${regionLabel} `);
        regions_fail.push(regionLabel);
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 150));
    }

    summary.push({ category, best_activity, regions_ok, regions_fail });
  }

  // ─── Print detailed summary ─────────────────────────────────────────────
  console.log("\n\n══════════════════════════════════════════════════════════════════");
  console.log("   SUMMARY TABLE");
  console.log("══════════════════════════════════════════════════════════════════");
  console.log(`${"CATEGORY".padEnd(18)} ${"REGIONS WITH EF".padEnd(40)} REGIONS WITHOUT EF`);
  console.log("─".repeat(90));

  let totalOk = 0;
  let totalFail = 0;

  for (const row of summary) {
    const okStr = row.regions_ok.join(", ") || "NONE";
    const failStr = row.regions_fail.join(", ") || "NONE";
    console.log(`${row.category.padEnd(18)} ${okStr.padEnd(40)} ${failStr}`);
    totalOk += row.regions_ok.length;
    totalFail += row.regions_fail.length;
  }

  console.log("─".repeat(90));
  const total = totalOk + totalFail;
  const pct = total > 0 ? ((totalOk / total) * 100).toFixed(1) : "0";
  console.log(`\n✅  ${totalOk}/${total} coverage  (${pct}% success rate)`);
  console.log(`❌  ${totalFail} region/category combos returned no EF\n`);

  // ─── Best activity IDs ──────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("   BEST CONFIRMED ACTIVITY IDs");
  console.log("══════════════════════════════════════════════════════════════════");
  for (const row of summary) {
    if (row.best_activity) {
      console.log(`${row.category.padEnd(18)} → ${row.best_activity}`);
    } else {
      console.log(`${row.category.padEnd(18)} → ⚠️  NO WORKING ACTIVITY FOUND`);
    }
  }
  console.log("");
}

main().catch(console.error);
