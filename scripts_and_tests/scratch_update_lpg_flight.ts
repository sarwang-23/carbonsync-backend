import { pool } from './src/db.js';

async function updateLPGAndFlight() {
  await pool.query(`
    UPDATE emission_factor_mappings
    SET activity_id = 'fuel-type_lpg-fuel_use_stationary'
    WHERE category = 'lpg' AND preferred_source = 'Climatiq'
  `);

  await pool.query(`
    UPDATE emission_factor_mappings
    SET activity_id = 'passenger_flight-route_type_domestic-aircraft_type_na-distance_na-class_na-rf_included-distance_uplift_included'
    WHERE category = 'flight' AND preferred_source = 'Climatiq'
  `);

  console.log("Updated DB for LPG and Flight");
}

updateLPGAndFlight().then(() => process.exit(0)).catch(console.error);
