import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  try {
    const res = await pool.query(`
      SELECT factor_id, name, category, factor, unit, scopes
      FROM official_emission_factors
      WHERE region = 'GB'
        AND lower(unit) like '%kwh%'
        AND factor::numeric > 0.15 
        AND factor::numeric < 0.25
      ORDER BY year DESC
      LIMIT 30
    `);
    console.log(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
