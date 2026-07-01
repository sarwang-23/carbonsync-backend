import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  // Simulate what findLocalOfficialFactor does for diesel
  const result = await pool.query(`
    SELECT factor_id, name, category, unit, factor
    FROM official_emission_factors
    WHERE region = 'US'
      AND is_active = true
      AND factor IS NOT NULL
      AND (
        lower(category) = lower('diesel')
        OR (
          lower('diesel') = 'diesel'
          AND (
            lower(name) LIKE '%distillate fuel oil%'
            OR lower(name) LIKE '%diesel%'
          )
        )
        OR lower(name) LIKE '%' || lower('diesel') || '%'
        OR lower('diesel') = ANY(SELECT lower(unnest(keywords)))
      )
    ORDER BY name
    LIMIT 10
  `);
  
  console.log("=== Diesel factor search result ===");
  console.table(result.rows);
  
  // Also check what happens with unit normalizeUnit('kg/gallon')
  // factorUnit = 'kg/gallon' -> activityUnit = 'gallon'
  // inputUnit = 'litre' -> normalizeUnit = 'litre'
  // litre vs gallon -> should trigger litre→gallon conversion
  console.log("\nUnit check:");
  console.log("factorUnit 'kg/gallon' -> activityUnit = 'gallon'");
  console.log("inputUnit 'litre' -> normalizedUnit = 'litre'");
  console.log("litre !== gallon -> should trigger conversion of 100 litre * 0.264172 = ", 100 * 0.264172, "gallon");
  
  await pool.end();
}

run().catch(console.error);
