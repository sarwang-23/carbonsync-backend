import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  // Check diesel/petrol/lpg official factors for US
  const fuels = await pool.query(`
    SELECT factor_id, name, category, unit, factor, source_lca_activity
    FROM official_emission_factors
    WHERE region='US'
      AND lower(category) IN ('petroleum products', 'diesel', 'petrol', 'lpg', 'petroleum products - liquid')
      AND is_active=true
    ORDER BY category, name
    LIMIT 20
  `);
  console.log("=== US Petroleum/Diesel/LPG factors ===");
  console.table(fuels.rows);

  // Check what diesel looks like when normalized unit search happens
  const diesel = await pool.query(`
    SELECT factor_id, name, category, unit, factor
    FROM official_emission_factors
    WHERE region='US' AND lower(name) like '%diesel%' AND is_active=true
  `);
  console.log("=== US Diesel-named factors ===");
  console.table(diesel.rows);

  await pool.end();
}

run().catch(console.error);
