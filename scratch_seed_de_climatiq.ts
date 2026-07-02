import { pool } from "./src/db.js";

// Insert Climatiq fallback mappings for Germany (DE)
// These mirror FR/US entries — same global Climatiq activity_ids
const rows = [
  {
    category: "petrol",
    activity_id: "fuel-type_motor_gasoline-fuel_use_stationary",
    parameter_name: "volume",
    parameter_unit: "l",
    keywords: ["petrol", "gasoline", "benzin"],
  },
  {
    category: "lpg",
    activity_id: "fuel-type_lpg-fuel_use_stationary",
    parameter_name: "volume",
    parameter_unit: "l",
    keywords: ["lpg", "autogas", "liquefied petroleum"],
  },
  {
    category: "coal",
    activity_id: "fuel-type_coal_bituminous-fuel_use_stationary",
    parameter_name: "weight",
    parameter_unit: "kg",
    keywords: ["coal", "kohle", "bituminous coal"],
  },
  {
    category: "freight",
    activity_id: "freight_vehicle-vehicle_type_hgv-fuel_source_diesel-vehicle_weight_na-percentage_load_avg",
    parameter_name: "weight_distance",
    parameter_unit: "tonne_km",
    keywords: ["freight", "road freight", "lkw", "logistics"],
  },
  {
    category: "railway",
    activity_id: "passenger_train-route_type_national_rail-fuel_source_na",
    parameter_name: "distance",
    parameter_unit: "km",
    keywords: ["railway", "train", "bahn", "rail"],
  },
  {
    category: "flight",
    activity_id: "passenger_flight-route_type_domestic-aircraft_type_na-distance_na-class_na-rf_included-distance_uplift_included",
    parameter_name: "distance",
    parameter_unit: "km",
    keywords: ["flight", "airline", "flug", "airport"],
  },
];

for (const row of rows) {
  // Check if already exists
  const existing = await pool.query(
    `select id from emission_factor_mappings where region='DE' and category=$1 and preferred_source='Climatiq' limit 1`,
    [row.category]
  );
  if (existing.rows.length > 0) {
    console.log(`SKIP (already exists): DE/${row.category}`);
    continue;
  }

  await pool.query(
    `insert into emission_factor_mappings
     (region, country_name, category, activity_id, parameter_name, parameter_unit, preferred_source, keywords, is_active, data_version)
     values ('DE', 'Germany', $1, $2, $3, $4, 'Climatiq', $5, true, '^6')`,
    [row.category, row.activity_id, row.parameter_name, row.parameter_unit, row.keywords]
  );
  console.log(`INSERTED: DE/${row.category} → ${row.activity_id}`);
}

console.log("\nDone. Verifying...");
const verify = await pool.query(
  `select category, activity_id, parameter_name, parameter_unit, preferred_source 
   from emission_factor_mappings where region='DE' order by preferred_source, category`
);
console.log(JSON.stringify(verify.rows, null, 2));
await pool.end();
