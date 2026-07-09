import "dotenv/config";
import axios from "axios";

const API_KEY = process.env.CLIMATIQ_API_KEY;

const SEARCHES = [
  // More targeted searches
  { label: "food-global",      query: "food average global", params: { region: "GLOBAL" } },
  { label: "food-pork",        query: "pork meat food", params: {} },
  { label: "agriculture",      query: "fertiliser average nitrogen agriculture", params: {} },
  { label: "agriculture2",     query: "wheat grain cereal crop", params: {} },
  { label: "glass-global",     query: "glass float flat", params: { region: "GLOBAL" } },
  { label: "glass-weight",     query: "glass production flat", params: {} },
];

async function search(query: string, extra: any = {}) {
  const resp = await axios.get("https://api.climatiq.io/data/v1/search", {
    headers: { Authorization: `Bearer ${API_KEY}` },
    params: { query, data_version: "^6", results_per_page: 5, ...extra },
  });
  return (resp.data?.results || []) as any[];
}

async function main() {
  for (const s of SEARCHES) {
    console.log(`\n──── ${s.label} ────`);
    try {
      const results = await search(s.query, s.params);
      if (!results.length) { console.log("  No results"); continue; }
      for (const r of results) {
        console.log(`  ✅ ${r.activity_id}  [region: ${r.region}]`);
        console.log(`     unit_types: ${JSON.stringify(r.unit_types)}`);
      }
    } catch (e: any) { console.log(`  ❌ ${e.message}`); }
    await new Promise(r => setTimeout(r, 200));
  }
}

main().then(() => process.exit(0)).catch(console.error);
