import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  await pool.query(
    `UPDATE emission_factor_mappings 
     SET parameter_name = 'weight_distance', parameter_unit = 'tonne_km' 
     WHERE region = 'US' AND category = 'freight' AND preferred_source = 'Climatiq'`
  );
  console.log('Updated freight parameters');
  await pool.end();
}

run().catch(console.error);
