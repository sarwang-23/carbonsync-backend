import "dotenv/config";
import { calculateIndiaClimatiqFallback } from "./src/services/IndiaClimatiqFallback.service";

const REGIONS = ["IN", "AU", "US", "GB", "EU"];
const CATEGORIES = [
  // Core / General
  { name: "steel", value: 1, unit: "tonne" },
  { name: "aluminium", value: 1, unit: "tonne" },
  { name: "chemicals", value: 1000, unit: "inr" },
  { name: "paper", value: 1, unit: "tonne" },
  { name: "plastic", value: 1000, unit: "inr" },
  { name: "glass", value: 1, unit: "tonne" },
  { name: "food", value: 1, unit: "tonne" },
  { name: "agriculture", value: 1, unit: "tonne" },
  { name: "electronics", value: 1000, unit: "inr" },
  { name: "automotive", value: 1000, unit: "inr" },
  { name: "construction", value: 1, unit: "tonne" },
  { name: "textile", value: 1000, unit: "inr" },
  { name: "wood", value: 1, unit: "tonne" },
  // Newly Added Materials
  { name: "lime", value: 1, unit: "tonne" },
  { name: "refractory", value: 1, unit: "tonne" },
  { name: "industrial_gas", value: 1, unit: "tonne" },
  { name: "bauxite", value: 1, unit: "tonne" },
  { name: "aggregates", value: 1, unit: "tonne" },
  { name: "cast_iron", value: 1, unit: "tonne" },
  { name: "cement", value: 1, unit: "tonne" },
  { name: "coal", value: 1, unit: "tonne" },
  { name: "coke", value: 1, unit: "tonne" },
  { name: "limestone", value: 1, unit: "tonne" },
  { name: "dolomite", value: 1, unit: "tonne" },
  // Steel & Metal Variants
  { name: "iron_ore", value: 1, unit: "tonne" },
  { name: "pig_iron", value: 1, unit: "tonne" },
  { name: "dri", value: 1, unit: "tonne" },
  { name: "billet", value: 1, unit: "tonne" },
  { name: "bloom", value: 1, unit: "tonne" },
  { name: "slab", value: 1, unit: "tonne" },
  { name: "steel_scrap", value: 1, unit: "tonne" },
  { name: "ferro_alloy", value: 1, unit: "tonne" },
  { name: "stainless_steel", value: 1, unit: "tonne" },
  { name: "alloy_steel", value: 1, unit: "tonne" },
  { name: "finished_steel", value: 1, unit: "tonne" },
  { name: "semi_finished_steel", value: 1, unit: "tonne" },
  { name: "raw_material_steel", value: 1, unit: "tonne" },
  { name: "steel_sheet", value: 1, unit: "tonne" },
  { name: "steel_plate", value: 1, unit: "tonne" },
  { name: "steel_coil", value: 1, unit: "tonne" },
  { name: "steel_pipe", value: 1, unit: "tonne" },
  { name: "structural_steel", value: 1, unit: "tonne" }
];

async function main() {
  console.log("Starting backend fallback tests...\n");

  for (const cat of CATEGORIES) {
    process.stdout.write(`Testing ${cat.name.padEnd(15)}: `);
    let successCount = 0;
    
    for (const region of REGIONS) {
      try {
        const input = {
          category: cat.name,
          value: cat.value,
          unit: cat.unit,
          amount: cat.name !== "textile" && cat.unit === "inr" ? 1000 : undefined,
          currency: cat.unit === "inr" ? "inr" : undefined,
          region: region,
          expectedParameterName: cat.unit === "inr" ? "money" : "weight",
          expectedParameterUnit: cat.unit === "inr" ? "inr" : "kg",
          item_name: "test item"
        };
        
        const result = await calculateIndiaClimatiqFallback(input as any);
        if (result && (result.co2e || result.success)) {
          process.stdout.write(`✅ ${region} `);
          successCount++;
        } else {
          process.stdout.write(`❌ ${region} `);
        }
      } catch (err: any) {
        process.stdout.write(`❌ ${region} `);
      }
      
      // Delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }
    console.log(` | ${successCount}/${REGIONS.length} passed`);
  }
}

main().then(() => process.exit(0)).catch(console.error);
