import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  try {
    const res = await pool.query("SELECT * FROM emission_factor_mappings WHERE region = 'GB' AND category = 'railway'");
    console.log(res.rows[0]);
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
