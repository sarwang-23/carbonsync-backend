/**
 * find_coke_activity.ts
 * Searches Climatiq for correct coke activity IDs
 * Run: npx tsx find_coke_activity.ts
 */
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.CLIMATIQ_API_KEY;
const BASE_URL = "https://api.climatiq.io/data/v1";

async function search(query: string, region?: string) {
  const params = new URLSearchParams({
    query,
    data_version: "^6",
    results_per_page: "5",
  });
  if (region) params.set("region", region);

  const res = await fetch(`${BASE_URL}/search?${params}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const data = (await res.json()) as any;
  return (data.results || data.data || []) as any[];
}

async function main() {
  if (!API_KEY) {
    console.error("CLIMATIQ_API_KEY not set in .env");
    process.exit(1);
  }

  const queries = [
    { q: "coke",               region: "GLO" },
    { q: "coke",               region: "RoW" },
    { q: "coke",               region: undefined },
    { q: "metallurgical coke", region: "GLO" },
    { q: "coke breeze",        region: "GLO" },
    { q: "coal coke",          region: "GLO" },
    { q: "coke production",    region: "GLO" },
    { q: "petroleum coke",     region: "GLO" },
  ];

  for (const { q, region } of queries) {
    console.log(`\n🔍 query="${q}" region=${region || "any"}`);
    try {
      const results = await search(q, region);
      if (results.length === 0) {
        console.log("  ❌ No results");
      } else {
        results.slice(0, 3).forEach((r: any) => {
          console.log(`  ✅ ${r.activity_id}  |  region=${r.region}  |  name="${r.name}"`);
        });
      }
    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`);
    }
  }
  process.exit(0);
}

main().catch(console.error);
