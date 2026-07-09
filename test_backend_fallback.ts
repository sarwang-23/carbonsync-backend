import "dotenv/config";
import { calculateIndiaClimatiqFallback } from "./src/services/IndiaClimatiqFallback.service";

const REGIONS = ["IN", "AU", "US", "GB", "EU"];
const CATEGORIES = [
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
  { name: "textile", value: 1000, unit: "inr" }
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
