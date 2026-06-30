import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  try {
    console.log("=== Official Emission Factors Count by Region ===");
    const resCount = await pool.query(`
      select region, count(*) as total_count
      from official_emission_factors
      group by region
      order by region
    `);
    console.log(resCount.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();


