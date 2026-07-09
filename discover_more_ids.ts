import "dotenv/config";
import axios from "axios";

const API_KEY = process.env.CLIMATIQ_API_KEY;

const SEARCHES = [
  { label: "lime",         query: "lime production", unit: "weight" },
  { label: "refractory",   query: "refractory product", unit: "weight" },
  { label: "industrial_gas", query: "industrial gas", unit: "weight" },
  { label: "bauxite",      query: "bauxite", unit: "weight" },
  { label: "aggregates",   query: "aggregate stone", unit: "weight" },
  { label: "cast_iron",    query: "cast iron", unit: "weight" },
];

async function searchClimatiq(query: string, unitType: string) {
  const resp = await axios.get("https://api.climatiq.io/data/v1/search", {
    headers: { Authorization: `Bearer ${API_KEY}` },
    params: { query, data_version: "^6", results_per_page: 5 },
  });
  return (resp.data?.results || []) as any[];
}

async function main() {
  for (const s of SEARCHES) {
    console.log(`\n──── ${s.label.toUpperCase()} ────`);
    try {
      const results = await searchClimatiq(s.query, s.unit);
      if (results.length === 0) {
        console.log("  No results found");
      } else {
        for (const r of results) {
          console.log(`  ✅ ${r.activity_id} [region: ${r.region}]`);
          console.log(`     name: ${r.name}`);
        }
      }
    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
}

main().then(() => process.exit(0)).catch(console.error);
