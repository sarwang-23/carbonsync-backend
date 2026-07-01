import { pool } from './src/db.js';

// Check what FR mappings exist (all preferred_source)
const r = await pool.query(
  `select id, region, category, activity_id, preferred_source, parameter_name, parameter_unit, is_active
   from emission_factor_mappings 
   where region = 'FR' 
   order by category, preferred_source`
);
console.log("All FR mappings:");
r.rows.forEach((row: any) => {
  console.log(`  [${row.id}] ${row.category} | source=${row.preferred_source} | activity_id=${row.activity_id} | active=${row.is_active}`);
});

// Also check US/GB for reference Climatiq activity_ids
const r2 = await pool.query(
  `select region, category, activity_id, preferred_source, parameter_name, parameter_unit
   from emission_factor_mappings 
   where preferred_source = 'Climatiq'
     and activity_id is not null
     and category in ('natural_gas','petrol','lpg','coal','freight','railway','flight','electricity','diesel')
   order by region, category
   limit 50`
);
console.log("\nExisting Climatiq mappings with activity_id:");
r2.rows.forEach((row: any) => {
  console.log(`  ${row.region} | ${row.category} | ${row.activity_id} | param=${row.parameter_name}/${row.parameter_unit}`);
});

process.exit(0);
