import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  try {
    await pool.query(
      `UPDATE emission_factor_mappings SET parameter_name = 'distance', parameter_unit = 'km' WHERE region = 'GB' AND category = 'railway'`
    );
    console.log('Updated GB railway parameter_name to distance and km');
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
