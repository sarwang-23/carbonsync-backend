import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  // 1. Check emission_factor_mappings for US
  const mappings = await pool.query(`
    SELECT region, category, activity_id, parameter_name, parameter_unit, preferred_source, is_active
    FROM emission_factor_mappings
    WHERE region = 'US'
    ORDER BY category
  `);
  console.log("\n=== US emission_factor_mappings ===");
  console.table(mappings.rows);

  // 2. Check official_emission_factors for US petrol/gasoline
  const petrol = await pool.query(`
    SELECT factor_id, name, category, unit, factor, source_lca_activity
    FROM official_emission_factors
    WHERE region = 'US'
      AND (
        lower(name) like '%gasoline%'
        OR lower(name) like '%motor gasoline%'
        OR lower(name) like '%petrol%'
      )
      AND is_active = true
    LIMIT 10
  `);
  console.log("\n=== US Petrol/Gasoline Factors ===");
  console.table(petrol.rows);

  // 3. Check official_emission_factors for US natural gas / scf
  const gas = await pool.query(`
    SELECT factor_id, name, category, unit, factor
    FROM official_emission_factors
    WHERE region = 'US'
      AND lower(category) = 'natural_gas'
      AND is_active = true
    LIMIT 10
  `);
  console.log("\n=== US Natural Gas Factors ===");
  console.table(gas.rows);

  await pool.end();
}

run().catch(console.error);
