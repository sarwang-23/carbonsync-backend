import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  try {
    const res = await pool.query("SELECT * FROM emission_factor_mappings WHERE category IN ('flight', 'railway') LIMIT 5");
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

run();
