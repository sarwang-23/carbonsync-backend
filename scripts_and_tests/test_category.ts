import { detectCategoryFromText } from "./src/services/CategoryDetection.service.js";

const tests = [
  // Previously failing cases
  ["Coke Breeze", "coal"],
  ["Limestone", "limestone"],
  ["Ferro Silicon (70%)", "ferro_alloy"],
  ["Iron Ore Fines", "iron_ore"],
  // Other industry items
  ["Met Coke", "coal"],
  ["BF Coke", "coal"],
  ["Dolomite", "limestone"],
  ["Quick Lime", "limestone"],
  ["Ferro Manganese", "ferro_alloy"],
  ["Silico Manganese", "ferro_alloy"],
  ["Iron Ore Lumps", "iron_ore"],
  ["Sponge Iron", "iron_ore"],
  ["Steel Scrap", "scrap_metal"],
  ["Heavy Melting Scrap", "scrap_metal"],
  ["TMT Bar 16mm", "steel"],
  ["MS Billet", "steel"],
  ["High Speed Diesel", "diesel"],
  ["ULSD", "diesel"],
  ["Petrol 95", "petrol"],
  // Should NOT be steel anymore
  ["Iron Ore", "iron_ore"],     // was wrongly "steel"
];

let pass = 0;
let fail = 0;

for (const [input, expected] of tests) {
  const result = detectCategoryFromText(input);
  const ok = result === expected;
  const icon = ok ? "✅" : "❌";
  console.log(`${icon}  "${input}" → "${result}" (expected: "${expected}")`);
  if (ok) pass++; else fail++;
}

console.log(`\n${pass}/${tests.length} passed, ${fail} failed`);
