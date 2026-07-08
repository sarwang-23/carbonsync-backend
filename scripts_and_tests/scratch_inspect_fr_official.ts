import { pool } from './src/db.js';

async function inspect() {
  // All FR diesel records
  const r = await pool.query(`
    select id, factor_id, activity_id, name, category, source, unit, factor, source_lca_activity
    from official_emission_factors
    where region = 'FR' and (
      lower(category) = 'diesel'
      or lower(category) like '%petroleum%'
      or lower(name) like '%diesel%'
      or lower(name) like '%gazole%'
      or lower(name) like '%gasoil%'
      or lower(name) like '%distillate%'
    )
    and is_active = true
    order by factor desc
    limit 30
  `);
  console.log("FR diesel-related records in official_emission_factors:");
  console.log(r.rows.map(row => ({
    name: row.name,
    factor: row.factor,
    unit: row.unit,
    category: row.category,
    source: row.source,
    activity_id: row.activity_id
  })));
}

inspect().then(() => process.exit(0)).catch(console.error);
