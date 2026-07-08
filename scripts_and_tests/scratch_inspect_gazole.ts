import { pool } from './src/db.js';

async function inspect() {
  // Full record for the selected factor
  const r = await pool.query(`
    select 
      activity_id, name, factor, unit, year,
      source_lca_activity, source_dataset,
      sector, category, scopes,
      constituent_gases, raw_factor
    from official_emission_factors
    where activity_id = 'fr-base-carbone-26668'
  `);
  console.log("=== fr-base-carbone-26668 FULL RECORD ===");
  console.log(JSON.stringify(r.rows[0], null, 2));

  // All Gazole routier factors that are per-litre with their LCA activity
  const litreFactors = await pool.query(`
    select 
      activity_id, name, factor, unit, year,
      source_lca_activity, scopes
    from official_emission_factors
    where region = 'FR'
      and lower(name) like '%gazole routier%'
      and (lower(unit) like '%/litre' or lower(unit) like '%/liter')
    order by factor desc
  `);
  console.log("\n=== All Gazole routier kgCO2e/litre factors ===");
  for (const row of litreFactors.rows) {
    console.log(`  ${row.activity_id} | factor: ${row.factor} | lca: ${row.source_lca_activity} | scopes: ${JSON.stringify(row.scopes)}`);
  }

  // Check if combustion Gazole routier exists (looking for 2.5-3.0 range per litre)
  const combustion = await pool.query(`
    select 
      activity_id, name, factor, unit, year, source_lca_activity, scopes
    from official_emission_factors
    where region = 'FR'
      and lower(name) like '%gazole%'
      and (lower(source_lca_activity) like '%combustion%' or lower(source_lca_activity) like '%tank_to_wheel%' or lower(source_lca_activity) like '%use%')
    order by factor desc
    limit 15
  `);
  console.log("\n=== FR Gazole with combustion LCA activity ===");
  for (const row of combustion.rows) {
    console.log(`  ${row.activity_id} | ${row.name} | ${row.factor} ${row.unit} | lca: ${row.source_lca_activity} | scopes: ${JSON.stringify(row.scopes)}`);
  }
}

inspect().then(() => process.exit(0)).catch(console.error);
