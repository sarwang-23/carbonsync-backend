import { pool } from './src/db.js';

async function query() {
  // 1. Get table columns
  const cols = await pool.query(`
    select column_name, data_type 
    from information_schema.columns 
    where table_name = 'official_emission_factors'
    order by ordinal_position
  `);
  console.log("TABLE COLUMNS:", cols.rows);

  // 2. Get all FR diesel records (all columns)
  const fr = await pool.query(`
    select * from official_emission_factors 
    where region = 'FR' and category = 'diesel'
    limit 20
  `);
  console.log("\nFR DIESEL RECORDS:", JSON.stringify(fr.rows, null, 2));

  // 3. Also check what activity is mapped for diesel FR
  const mappings = await pool.query(`
    select * from emission_factor_mappings 
    where region = 'FR' and category = 'diesel'
  `);
  console.log("\nFR DIESEL MAPPINGS:", JSON.stringify(mappings.rows, null, 2));
}
query().then(() => process.exit(0)).catch(console.error);
