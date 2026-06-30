import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  try {
    const r = await pool.query("select * from emission_factor_mappings where region = 'DE'");
    console.log(JSON.stringify(r.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
