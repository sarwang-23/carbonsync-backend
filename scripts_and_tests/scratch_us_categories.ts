import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  const r = await pool.query(`
    SELECT region, category, activity_id, parameter_name, parameter_unit, preferred_source 
    FROM emission_factor_mappings 
    WHERE region = 'US' AND category IN ('railway','flight','freight') 
    ORDER BY category
  `);
  console.log("=== US freight/rail/flight mappings ===");
  console.table(r.rows);

  const g = await pool.query(`
    SELECT factor_id, name, category, unit, factor 
    FROM official_emission_factors 
    WHERE region='US' AND (lower(name) like '%natural gas%' OR lower(name) like '%methane%') AND is_active=true 
    LIMIT 10
  `);
  console.log("=== US Natural Gas factors ===");
  console.table(g.rows);

  const coal = await pool.query(`
    SELECT factor_id, name, category, unit, factor 
    FROM official_emission_factors 
    WHERE region='US' AND lower(category) like '%coal%' AND is_active=true 
    LIMIT 5
  `);
  console.log("=== US Coal factors ===");
  console.table(coal.rows);

  await pool.end();
}

run().catch(console.error);
