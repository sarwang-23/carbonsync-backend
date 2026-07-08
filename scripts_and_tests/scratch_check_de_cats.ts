import { pool } from "./src/db.js";

async function run() {
  const r = await pool.query(`select category, activity_id, preferred_source from emission_factor_mappings where region='DE'`);
  console.log("DE Categories:", r.rows);
  await pool.end();
}

run();
