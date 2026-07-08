import { searchClimatiqEmissionFactors } from "./src/services/climatiq.service.js";

async function run() {
  try {
    const res = await searchClimatiqEmissionFactors({
      query: "aggregate",
      region: "GB"
    });
    console.log(res.results.map((r: any) => ({id: r.activity_id, region: r.region, unit: r.unit, source: r.source})).filter((r:any) => r.unit.includes("kg")));
    
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
