import { calculateWithClimatiqFallback } from "./src/services/ClimatiqFallback.service.js";

// Test each failing category directly
const tests = [
  { category: "petrol",  value: 100, unit: "litre",       itemName: "Petrol 100 litre" },
  { category: "lpg",     value: 100, unit: "litre",       itemName: "LPG 100 litre" },
  { category: "coal",    value: 1,   unit: "tonne",       itemName: "Bituminous coal 1 tonne" },
  { category: "freight", value: 585, unit: "tonne-km",    itemName: "Road freight Berlin Munich" },
  { category: "railway", value: 585, unit: "passenger-km",itemName: "Rail travel Berlin Munich" },
  { category: "flight",  value: 505, unit: "passenger-km",itemName: "Flight Berlin Munich" },
];

for (const t of tests) {
  console.log(`\n=== ${t.category.toUpperCase()} ===`);
  try {
    const r = await calculateWithClimatiqFallback({
      region: "DE",
      countryName: "Germany",
      category: t.category,
      itemName: t.itemName,
      value: t.value,
      unit: t.unit,
    });
    if (r.success) {
      console.log(`✅ co2e=${r.co2e} ${r.co2e_unit}`);
    } else {
      console.log(`❌ reason=${(r as any).reason} | msg=${(r as any).message}`);
    }
  } catch (err: any) {
    console.log(`💥 THREW: ${err.message}`);
    console.log(`   response data:`, err?.response?.data);
  }
}
