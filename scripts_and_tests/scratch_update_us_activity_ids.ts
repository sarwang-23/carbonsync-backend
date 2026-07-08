import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  await pool.query(
    `UPDATE emission_factor_mappings 
     SET activity_id = $1 
     WHERE region = 'US' AND category = 'freight' AND preferred_source = 'Climatiq'`,
    ['freight_vehicle-vehicle_type_hgv-fuel_source_diesel-vehicle_weight_na-percentage_load_avg']
  );
  console.log("Updated freight activity_id");

  await pool.query(
    `UPDATE emission_factor_mappings 
     SET activity_id = $1 
     WHERE region = 'US' AND category = 'flight' AND preferred_source = 'Climatiq'`,
    ['passenger_flight-route_type_domestic-aircraft_type_na-distance_na-class_na-rf_included-distance_uplift_included']
  );
  console.log("Updated flight activity_id");

  await pool.end();
}

run().catch(console.error);
