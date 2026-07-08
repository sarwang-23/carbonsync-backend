import { pool } from './src/db.js';

async function standardizeClimatiqMappings() {
  const updates = [
    {
      category: 'electricity',
      activity_id: 'electricity-supply_grid-source_supplier_mix',
      parameter_name: 'energy',
      parameter_unit: 'kWh'
    },
    {
      category: 'natural_gas',
      activity_id: 'fuel-type_natural_gas-fuel_use_stationary',
      parameter_name: 'energy',
      parameter_unit: 'kWh'
    },
    {
      category: 'diesel',
      activity_id: 'fuel-type_distillate_fuel_oil_number_2-fuel_use_stationary', // US EPA factor that works nicely
      parameter_name: 'volume',
      parameter_unit: 'l'
    },
    {
      category: 'petrol',
      activity_id: 'fuel-type_motor_gasoline-fuel_use_stationary',
      parameter_name: 'volume',
      parameter_unit: 'l'
    },
    {
      category: 'lpg',
      activity_id: 'fuel-type_liquefied_petroleum_gas-fuel_use_stationary_combustion',
      parameter_name: 'volume',
      parameter_unit: 'l'
    },
    {
      category: 'coal',
      activity_id: 'fuel-type_coal_bituminous-fuel_use_stationary',
      parameter_name: 'weight',
      parameter_unit: 'kg'
    },
    {
      category: 'freight',
      activity_id: 'freight_vehicle-vehicle_type_hgv-fuel_source_diesel-vehicle_weight_na-percentage_load_avg',
      parameter_name: 'weight_distance',
      parameter_unit: 'tonne_km'
    },
    {
      category: 'railway',
      activity_id: 'passenger_train-route_type_national_rail-fuel_source_na',
      parameter_name: 'distance',
      parameter_unit: 'km'
    },
    {
      category: 'flight',
      activity_id: 'passenger_flight-route_type_na-aircraft_type_na-distance_na-class_economy-rf_included-distance_uplift_included',
      parameter_name: 'distance',
      parameter_unit: 'km'
    }
  ];

  console.log("Standardizing Climatiq Fallback Mappings...");
  
  for (const up of updates) {
    const res = await pool.query(`
      UPDATE emission_factor_mappings
      SET activity_id = $1, parameter_name = $2, parameter_unit = $3
      WHERE category = $4 AND preferred_source = 'Climatiq'
    `, [up.activity_id, up.parameter_name, up.parameter_unit, up.category]);
    
    console.log(`Updated ${res.rowCount} rows for category: ${up.category}`);
  }

  // Also make sure these mappings exist for France (if any are missing)
  const frCount = await pool.query("SELECT count(*) from emission_factor_mappings where region = 'FR' and preferred_source = 'Climatiq'");
  console.log(`France Climatiq mappings total: ${frCount.rows[0].count}`);
}

standardizeClimatiqMappings().then(() => process.exit(0)).catch(console.error);
