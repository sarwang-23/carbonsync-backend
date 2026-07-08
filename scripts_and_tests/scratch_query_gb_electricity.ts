import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  try {
    const res = await pool.query(`
      SELECT factor_id, name, category, factor, unit
      FROM official_emission_factors
      WHERE region = 'GB'
        AND (lower(category) = 'electricity' OR lower(name) like '%electricity%')
      ORDER BY year DESC
      LIMIT 20
    `);
    console.log(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
