import { pool } from "./src/db.js";
import { estimateWithClimatiqDirect } from "./src/services/climatiq.service.js";

// Test each activity ID with a small weight to verify it works
const TEST_CASES = [
  {
    category: "finished_steel",
    activity_id: "metals-type_iron_non_alloy_steel_bars_rods_nec",
    description: "MS / TMT Bars (Iron non-alloy steel bars/rods n.e.c.)"
  },
  {
    category: "finished_steel_alt",
    activity_id: "metals-type_iron_non_alloy_steel_hot_rolled_drawn_extruded_bars_rods_long",
    description: "MS / TMT Bars hot-rolled (backup)"
  },
];

async function testAndUpdate() {
  console.log("Testing TMT/Steel activity IDs...\n");

  let workingId: string | null = null;

  for (const tc of TEST_CASES) {
    try {
      const result = await estimateWithClimatiqDirect({
        activityId: tc.activity_id,
        parameterName: "weight",
        value: 1000,
        parameterUnit: "kg",
        dataVersion: "^6",
      });
      console.log(`✅ ${tc.description}`);
      console.log(`   activity_id: ${tc.activity_id}`);
      console.log(`   co2e: ${result.co2e} ${result.co2e_unit}`);
      console.log(`   factor: ${result.factor_name} (${result.factor_source})\n`);
      if (!workingId) workingId = tc.activity_id;
    } catch (err: any) {
      console.log(`❌ ${tc.description}: ${err.message}\n`);
    }
  }

  if (workingId) {
    console.log(`\nUpdating DB with working ID: ${workingId}`);
    await pool.query(
      `UPDATE emission_factor_mappings
       SET activity_id = $1, notes = $2, updated_at = NOW()
       WHERE region = 'IN' AND category = 'finished_steel'`,
      [workingId, "TMT Bars / MS Bars / Rebar — iron non-alloy steel"]
    );
    console.log("✅ DB updated for finished_steel");
  }

  await pool.end();
}

testAndUpdate().catch(console.error);
