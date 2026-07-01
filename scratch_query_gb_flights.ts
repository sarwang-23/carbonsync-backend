import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  try {
    const res = await pool.query(`
      SELECT factor_id, name, category, unit
      FROM official_emission_factors
      WHERE region = 'GB'
        AND lower(category) = 'flights' OR lower(category) = 'flight'
      LIMIT 10
    `);
    console.log(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
