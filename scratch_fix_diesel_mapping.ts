import { pool } from './src/db.js';

async function fix() {
  // 1. Update all Climatiq diesel mappings to use the correct activity
  const update = await pool.query(`
    UPDATE emission_factor_mappings
    SET activity_id = 'fuel-type_diesel-fuel_use_stationary',
        parameter_name = 'volume',
        parameter_unit = 'l'
    WHERE category = 'diesel' AND preferred_source = 'Climatiq'
  `);
  console.log(`Updated ${update.rowCount} diesel Climatiq mapping(s) to fuel-type_diesel-fuel_use_stationary`);

  // 2. Verify
  const check = await pool.query(`
    SELECT region, category, activity_id, preferred_source 
    FROM emission_factor_mappings 
    WHERE category = 'diesel' AND preferred_source = 'Climatiq'
  `);
  console.log("Current diesel Climatiq mappings:", check.rows);
}

fix().then(() => process.exit(0)).catch(console.error);
