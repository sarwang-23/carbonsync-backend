/**
 * debug_india_ef.ts
 * Tests the full India emission pipeline for Coke Breeze and Limestone
 * Run: npx tsx debug_india_ef.ts
 */
import { pool } from "./src/db.js";
import { calculateIndiaEmission } from "./src/services/IndiaEmission.service.js";

async function main() {
  console.log("\n========== STEP 1: Check DB mappings ==========");
  const dbCheck = await pool.query(`
    SELECT region, category, activity_id, parameter_name, parameter_unit, is_active
    FROM emission_factor_mappings
    WHERE region = 'IN' AND category IN ('coke', 'limestone', 'dolomite')
    ORDER BY category
  `);
  console.log("DB rows found:", dbCheck.rows.length);
  console.table(dbCheck.rows);

  console.log("\n========== STEP 2: Test Coke Breeze emission ==========");
  try {
    const cokeResult = await calculateIndiaEmission({
      category: "coke",
      itemName: "Coke Breeze",
      value: 1000,
      unit: "kg",
    });
    console.log("Coke result:", JSON.stringify(cokeResult, null, 2));
  } catch (e: any) {
    console.error("Coke ERROR:", e.message);
  }

  console.log("\n========== STEP 3: Test Limestone emission ==========");
  try {
    const lsResult = await calculateIndiaEmission({
      category: "limestone",
      itemName: "Limestone",
      value: 1000,
      unit: "kg",
    });
    console.log("Limestone result:", JSON.stringify(lsResult, null, 2));
  } catch (e: any) {
    console.error("Limestone ERROR:", e.message);
  }

  await pool.end();
  process.exit(0);
}

main().catch(console.error);
