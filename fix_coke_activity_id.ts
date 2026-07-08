/**
 * fix_coke_activity_id.ts
 * Updates the India coke mapping to the correct GLOBAL Climatiq activity ID
 * Run: npx tsx fix_coke_activity_id.ts
 */
import { pool } from "./src/db.js";

async function main() {
  console.log("🔧 Fixing coke activity_id in emission_factor_mappings...\n");

  // The correct Climatiq activity ID for coke that has GLOBAL coverage
  const CORRECT_ACTIVITY_ID = "fuel-type_coke_oven_coke_and_lignite_coke-fuel_use_na";

  // Update India coke mapping
  const result = await pool.query(
    `UPDATE emission_factor_mappings
     SET activity_id      = $1,
         preferred_lca_activity = 'fuel_use',
         parameter_name   = 'weight',
         parameter_unit   = 'kg'
     WHERE region = 'IN'
       AND category = 'coke'
       AND preferred_source = 'Climatiq'
     RETURNING id, category, activity_id`,
    [CORRECT_ACTIVITY_ID]
  );

  if (result.rowCount === 0) {
    console.log("⚠️  No coke mapping found for IN — inserting...");
    await pool.query(
      `INSERT INTO emission_factor_mappings
         (region, country_name, category, keywords, activity_id,
          preferred_source, preferred_lca_activity, parameter_name, parameter_unit, is_active, data_version)
       VALUES
         ('IN', 'India', 'coke',
          ARRAY['coke', 'coke breeze', 'met coke', 'metallurgical coke', 'bf coke', 'pet coke'],
          $1, 'Climatiq', 'fuel_use', 'weight', 'kg', true, '^6')`,
      [CORRECT_ACTIVITY_ID]
    );
    console.log(`  ✅ Inserted coke → ${CORRECT_ACTIVITY_ID}`);
  } else {
    console.log(`  ✅ Updated: ${result.rows[0].id} | ${result.rows[0].category} → ${result.rows[0].activity_id}`);
  }

  // Verify
  const verify = await pool.query(
    `SELECT region, category, activity_id FROM emission_factor_mappings
     WHERE region = 'IN' AND category = 'coke'`
  );
  console.log("\n✅ Verification:");
  console.table(verify.rows);

  // Now test the Climatiq call directly to confirm it works
  console.log("\n🧪 Testing Climatiq call with GLOBAL region...");
  const apiKey = process.env.CLIMATIQ_API_KEY;
  if (apiKey) {
    const res = await fetch("https://api.climatiq.io/data/v1/estimate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emission_factor: {
          activity_id: CORRECT_ACTIVITY_ID,
          data_version: "^6",
        },
        parameters: {
          weight: 1000,
          weight_unit: "kg",
        },
      }),
    });
    const data = (await res.json()) as any;
    if (res.ok) {
      console.log(`  ✅ Coke EF works! co2e = ${data.co2e} ${data.co2e_unit} per 1000 kg`);
      console.log(`     Factor: ${data.emission_factor?.name} | Region: ${data.emission_factor?.region}`);
    } else {
      console.log(`  ❌ Climatiq error: ${JSON.stringify(data)}`);
    }
  } else {
    console.log("  ⚠️  CLIMATIQ_API_KEY not available for direct test");
  }

  await pool.end();
  process.exit(0);
}

main().catch(console.error);
