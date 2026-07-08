import { pool } from './src/db.js';

async function query() {
  const res = await pool.query(`
    select region, category, activity_id, preferred_source 
    from emission_factor_mappings 
    where category in ('natural_gas', 'petrol', 'diesel', 'lpg') 
      and activity_id is not null
  `);
  console.log(res.rows);
}
query().then(() => process.exit(0));
