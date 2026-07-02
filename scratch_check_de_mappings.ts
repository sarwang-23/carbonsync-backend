import { pool } from "./src/db.js";

// Check what the fallback query returns for coal, freight, railway, flight
const tests = ["coal", "freight", "railway", "flight"];
for (const cat of tests) {
  const r = await pool.query(
    `select region, category, activity_id, parameter_name, parameter_unit, preferred_source, is_active
     from emission_factor_mappings
     where region = 'DE' and category = $1 and preferred_source = 'Climatiq' and is_active = true
     order by id asc limit 1`,
    [cat]
  );
  console.log(`${cat}:`, r.rows[0] || "NOT FOUND");
}
await pool.end();
