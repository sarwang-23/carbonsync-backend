import { pool } from "./src/db.js";

async function run() {
  try {
    const res = await pool.query("SELECT * FROM emission_factor_mappings WHERE category = 'limestone'");
    console.log("Existing mappings:", res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
