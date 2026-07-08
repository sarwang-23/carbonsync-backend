import { pool } from "./src/db.js";

const r = await pool.query(`select category from emission_factor_mappings where region='DE' and category in ('petrol', 'lpg')`);
console.log("Found:", r.rows.map(x => x.category));
await pool.end();
