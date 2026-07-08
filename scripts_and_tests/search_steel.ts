import { searchClimatiqEmissionFactors } from "./src/services/climatiq.service.js";

async function search(query: string) {
  try {
    const res = await searchClimatiqEmissionFactors({ query, region: "GLO" });
    if (res.results.length === 0) {
      const resIN = await searchClimatiqEmissionFactors({ query, region: "IN" });
      if (resIN.results.length === 0) {
          const resFR = await searchClimatiqEmissionFactors({ query, region: "US" });
          return resFR.results.slice(0, 2);
      }
      return resIN.results.slice(0, 2);
    }
    return res.results.slice(0, 2);
  } catch (e) {
    return [];
  }
}

async function run() {
  const queries = [
    "steel bars",
    "structural steel",
    "steel plate",
    "steel sheet",
    "steel pipe",
    "ferro",
    "cast iron",
    "iron ores",
    "quartz"
  ];
  for (const q of queries) {
      const results = await search(q);
      console.log(`[${q}]`);
      results.forEach((r: any) => console.log(`  ${r.activity_id} | ${r.name} | ${r.unit} | ${r.source}`));
  }
}
run();
