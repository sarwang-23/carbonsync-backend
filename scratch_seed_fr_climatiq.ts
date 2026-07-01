import { pool } from './src/db.js';

/**
 * Seed Climatiq activity_ids for France (FR) categories
 * Based on Climatiq's standard activity IDs for European regions
 */

const frClimatiqMappings = [
  // Natural Gas - FR specific or EU fallback
  {
    region: 'FR',
    country_name: 'France',
    category: 'natural_gas',
    keywords: ['natural gas', 'gaz naturel', 'gaz', 'gas'],
    activity_id: 'fuel_combustion-type_natural_gas-fuel_source_natural_gas',
    preferred_source: 'Climatiq',
    preferred_lca_activity: 'combustion',
    parameter_name: 'energy',
    parameter_unit: 'kWh',
    data_version: '^6',
  },
  // Petrol / Gasoline
  {
    region: 'FR',
    country_name: 'France',
    category: 'petrol',
    keywords: ['petrol', 'gasoline', 'essence', 'motor gasoline'],
    activity_id: 'fuel_combustion-type_petrol-fuel_source_motor_gasoline',
    preferred_source: 'Climatiq',
    preferred_lca_activity: 'combustion',
    parameter_name: 'volume',
    parameter_unit: 'l',
    data_version: '^6',
  },
  // LPG
  {
    region: 'FR',
    country_name: 'France',
    category: 'lpg',
    keywords: ['lpg', 'liquefied petroleum gas', 'gpl', 'propane', 'butane'],
    activity_id: 'fuel_combustion-type_lpg-fuel_source_lpg',
    preferred_source: 'Climatiq',
    preferred_lca_activity: 'combustion',
    parameter_name: 'volume',
    parameter_unit: 'l',
    data_version: '^6',
  },
  // Coal
  {
    region: 'FR',
    country_name: 'France',
    category: 'coal',
    keywords: ['coal', 'charbon', 'houille'],
    activity_id: 'fuel_combustion-type_coal-fuel_source_coal_and_coke',
    preferred_source: 'Climatiq',
    preferred_lca_activity: 'combustion',
    parameter_name: 'energy',
    parameter_unit: 'kWh',
    data_version: '^6',
  },
  // Diesel
  {
    region: 'FR',
    country_name: 'France',
    category: 'diesel',
    keywords: ['diesel', 'gasoil', 'gazole', 'distillate'],
    activity_id: 'fuel_combustion-type_diesel-fuel_source_diesel',
    preferred_source: 'Climatiq',
    preferred_lca_activity: 'combustion',
    parameter_name: 'volume',
    parameter_unit: 'l',
    data_version: '^6',
  },
  // Electricity - FR specific (very low carbon due to nuclear)
  {
    region: 'FR',
    country_name: 'France',
    category: 'electricity',
    keywords: ['electricity', 'electricite', 'électricité', 'power', 'kwh'],
    activity_id: 'electricity-supply_grid-source_supplier_mix',
    preferred_source: 'Climatiq',
    preferred_lca_activity: 'supply',
    parameter_name: 'energy',
    parameter_unit: 'kWh',
    data_version: '^6',
  },
  // Road Freight
  {
    region: 'FR',
    country_name: 'France',
    category: 'freight',
    keywords: ['freight', 'road freight', 'transport marchandises', 'logistics', 'hgv', 'truck'],
    activity_id: 'freight_vehicle-vehicle_type_hgv-fuel_source_diesel-vehicle_weight_na-percentage_load_avg',
    preferred_source: 'Climatiq',
    preferred_lca_activity: 'transport',
    parameter_name: 'weight_distance',
    parameter_unit: 'tonne_km',
    data_version: '^6',
  },
  // Railway passenger
  {
    region: 'FR',
    country_name: 'France',
    category: 'railway',
    keywords: ['railway', 'rail', 'train', 'sncf', 'tgv', 'metro', 'transport ferroviaire'],
    activity_id: 'passenger_train-route_type_national_rail-fuel_source_na',
    preferred_source: 'Climatiq',
    preferred_lca_activity: 'passenger_transport',
    parameter_name: 'distance',
    parameter_unit: 'km',
    data_version: '^6',
  },
  // Flight
  {
    region: 'FR',
    country_name: 'France',
    category: 'flight',
    keywords: ['flight', 'air travel', 'aviation', 'passenger flight', 'vol'],
    activity_id: 'passenger_flight-route_type_na-aircraft_type_na-distance_na-class_economy-rf_included-distance_uplift_included',
    preferred_source: 'Climatiq',
    preferred_lca_activity: 'passenger_flight',
    parameter_name: 'distance',
    parameter_unit: 'km',
    data_version: '^6',
  },
];

console.log('Seeding Climatiq activity IDs for France (FR)...\n');

for (const mapping of frClimatiqMappings) {
  // Check if Climatiq mapping already exists
  const existing = await pool.query(
    `select id from emission_factor_mappings 
     where region = $1 and category = $2 and preferred_source = 'Climatiq' and activity_id = $3`,
    [mapping.region, mapping.category, mapping.activity_id]
  );

  if (existing.rows.length > 0) {
    console.log(`  SKIP (already exists): ${mapping.category} -> ${mapping.activity_id}`);
    continue;
  }

  await pool.query(
    `INSERT INTO emission_factor_mappings 
      (region, country_name, category, keywords, activity_id, preferred_source, preferred_lca_activity, parameter_name, parameter_unit, data_version, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, now(), now())`,
    [
      mapping.region,
      mapping.country_name,
      mapping.category,
      mapping.keywords,
      mapping.activity_id,
      mapping.preferred_source,
      mapping.preferred_lca_activity,
      mapping.parameter_name,
      mapping.parameter_unit,
      mapping.data_version,
    ]
  );
  console.log(`  INSERTED: ${mapping.category} -> ${mapping.activity_id}`);
}

console.log('\nDone! Verifying inserted rows...');
const verify = await pool.query(
  `select category, activity_id, preferred_source, parameter_name, parameter_unit
   from emission_factor_mappings 
   where region = 'FR' and preferred_source = 'Climatiq' and activity_id is not null
   order by category`
);
console.log(`\nFR Climatiq mappings (${verify.rows.length} total):`);
verify.rows.forEach((row: any) => {
  console.log(`  ${row.category}: ${row.activity_id} | ${row.parameter_name}/${row.parameter_unit}`);
});

process.exit(0);
