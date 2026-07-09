/**
 * test_search_activities.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Searches Climatiq for working activity IDs for each failed category.
 * Uses the SEARCH API (not estimate) to find real activity_ids.
 *
 * Run:  npx tsx test_search_activities.ts
 */

import "dotenv/config";
import axios from "axios";

const SEARCH_URL = "https://api.climatiq.io/data/v1/search";
const ESTIMATE_URL = "https://api.climatiq.io/data/v1/estimate";
const API_KEY = process.env.CLIMATIQ_API_KEY!;
const DATA_VERSION = process.env.CLIMATIQ_DATA_VERSION || "^21";

// ─── Search for activities ────────────────────────────────────────────────────
async function searchActivities(query: string, region?: string) {
  try {
    const params: any = {
      query,
      data_version: DATA_VERSION,
      results_per_page: 5,
    };
    if (region) params.region = region;

    const res = await axios.get(SEARCH_URL, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      params,
      timeout: 10000,
    });
    return res.data?.results || [];
  } catch (e: any) {
    return [];
  }
}

// ─── Try estimate with a given activity_id and parameters ────────────────────
async function tryEstimate(activity_id: string, region: string | undefined, params: Record<string, any>) {
  try {
    const ef: any = { activity_id, data_version: DATA_VERSION };
    if (region) ef.region = region;
    const payload = { emission_factor: ef, parameters: params };
    const res = await axios.post(ESTIMATE_URL, payload, {
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      timeout: 10000,
    });
    return {
      ok: true,
      co2e: res.data?.co2e,
      unit: res.data?.co2e_unit,
      param_type: Object.keys(params)[0],
    };
  } catch (e: any) {
    const errData = e?.response?.data;
    return {
      ok: false,
      error: errData?.error || errData?.message || e?.message || "unknown",
      details: JSON.stringify(errData?.possible_parameters || "").slice(0, 120),
    };
  }
}

// ─── Categories to investigate ───────────────────────────────────────────────
const SEARCHES = [
  { category: "steel",         query: "steel",                 param_sets: [{ weight: 1, weight_unit: "t" }, { money: 100, money_unit: "usd" }] },
  { category: "aluminium",     query: "aluminium primary",     param_sets: [{ weight: 1, weight_unit: "t" }, { money: 100, money_unit: "usd" }] },
  { category: "chemicals",     query: "industrial chemicals",  param_sets: [{ weight: 1, weight_unit: "t" }, { money: 100, money_unit: "usd" }] },
  { category: "paper",         query: "paper packaging",       param_sets: [{ weight: 1, weight_unit: "t" }, { money: 100, money_unit: "usd" }] },
  { category: "plastic",       query: "plastic polymer",       param_sets: [{ weight: 1, weight_unit: "t" }, { money: 100, money_unit: "usd" }] },
  { category: "food",          query: "food processing",       param_sets: [{ weight: 1, weight_unit: "t" }, { money: 100, money_unit: "usd" }] },
  { category: "agriculture",   query: "fertilizer crop",       param_sets: [{ weight: 1, weight_unit: "t" }, { money: 100, money_unit: "usd" }] },
  { category: "electronics",   query: "electronics consumer",  param_sets: [{ money: 100, money_unit: "usd" }, { weight: 1, weight_unit: "t" }] },
  { category: "automotive",    query: "motor vehicle parts",   param_sets: [{ money: 100, money_unit: "usd" }, { weight: 1, weight_unit: "t" }] },
  { category: "construction",  query: "construction materials", param_sets: [{ weight: 1, weight_unit: "t" }, { money: 100, money_unit: "usd" }] },
  { category: "fuel_diesel",   query: "diesel fuel",           param_sets: [{ volume: 100, volume_unit: "l" }, { energy: 100, energy_unit: "GJ" }] },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("   CLIMATIQ ACTIVITY SEARCH & ESTIMATE VALIDATION");
  console.log("══════════════════════════════════════════════════════════════════\n");

  const confirmed: Record<string, { activity_id: string; param_type: string; regions: string[] }> = {};

  for (const { category, query, param_sets } of SEARCHES) {
    console.log(`\n────────────────────────────────────────────────────────────`);
    console.log(`🔍 Category: ${category.toUpperCase()} | Query: "${query}"`);

    // Search for top activity IDs
    const results = await searchActivities(query);
    if (results.length === 0) {
      console.log(`   ⚠️  No search results found for "${query}"`);
      continue;
    }

    console.log(`   Found ${results.length} activities:`);
    for (const r of results) {
      console.log(`   • ${r.activity_id}  [${r.region || "GLOBAL"}]  (${r.source || ""})`);
    }

    // Try to estimate with the top activity IDs
    const regionsToTest = ["IN", "AU", "US", undefined];
    const working_regions: string[] = [];
    let best_activity = "";
    let best_param = "";

    for (const r of results.slice(0, 3)) {
      const activity_id = r.activity_id;

      for (const params of param_sets) {
        for (const region of regionsToTest) {
          const result = await tryEstimate(activity_id, region, params);
          const regionLabel = region ?? "GLOBAL";

          if (result.ok) {
            working_regions.push(`${regionLabel}(${Object.keys(params)[0]})`);
            best_activity = activity_id;
            best_param = Object.keys(params)[0];
            console.log(`   ✅ ${activity_id} | region=${regionLabel} | param=${Object.keys(params)[0]} | co2e=${result.co2e} ${result.unit}`);
          }
          await new Promise(r => setTimeout(r, 100));
        }
      }
      if (best_activity) break; // Found a working one, stop trying others
    }

    if (best_activity) {
      confirmed[category] = { activity_id: best_activity, param_type: best_param, regions: working_regions };
    } else {
      console.log(`   ❌  No working estimate found for ${category}`);
    }
  }

  // ─── Final confirmed activities table ─────────────────────────────────────
  console.log("\n\n══════════════════════════════════════════════════════════════════");
  console.log("   ✅  CONFIRMED WORKING ACTIVITY IDs");
  console.log("══════════════════════════════════════════════════════════════════");
  for (const [cat, info] of Object.entries(confirmed)) {
    console.log(`${cat.padEnd(16)} → ${info.activity_id}`);
    console.log(`${"".padEnd(16)}   param_type: ${info.param_type} | regions: ${info.regions.join(", ")}`);
  }

  const failed = SEARCHES.map(s => s.category).filter(c => !confirmed[c]);
  if (failed.length > 0) {
    console.log("\n❌  STILL NO WORKING ACTIVITY:");
    failed.forEach(c => console.log(`   • ${c}`));
    console.log("\n   💡  These categories may need spend-based (money) Climatiq fallback.");
  }
  console.log("");
}

main().catch(console.error);
