import 'dotenv/config';
import { estimateWithClimatiq } from './src/services/climatiq.service.js';
import { pool } from './src/db.js';

async function testClimatiq() {
  const ids = [
    'fuel-type_natural_gas-fuel_use_stationary_combustion',
    'fuel-type_petrol-fuel_use_stationary_combustion',
    'fuel-type_motor_gasoline-fuel_use_mobile',
    'fuel-type_diesel-fuel_use_stationary_combustion',
    'fuel-type_lpg-fuel_use_stationary_combustion'
  ];

  for (const act of ids) {
    try {
      console.log(`\nTesting ${act}...`);
      const res = await estimateWithClimatiq({
        selectedEF: { activity_id: act },
        parameters: { energy: 100, energy_unit: 'kWh', volume: 100, volume_unit: 'l' }
      });
      console.log(`Success! CO2e: ${res.data.co2e} ${res.data.co2e_unit} | Factor: ${res.data.emission_factor.name} | Region: ${res.data.emission_factor.region}`);
    } catch (e: any) {
      console.log(`Failed! ${e.response?.data?.error_code || e.message}`);
    }
  }

  // Update DB for FR
  await pool.query(`
    UPDATE emission_factor_mappings 
    SET activity_id = 'fuel-type_natural_gas-fuel_use_stationary_combustion'
    WHERE region = 'FR' and category = 'natural_gas' and preferred_source = 'Climatiq'
  `);
  
  await pool.query(`
    UPDATE emission_factor_mappings 
    SET activity_id = 'fuel-type_motor_gasoline-fuel_use_mobile'
    WHERE region = 'FR' and category = 'petrol' and preferred_source = 'Climatiq'
  `);

  await pool.query(`
    UPDATE emission_factor_mappings 
    SET activity_id = 'fuel-type_diesel-fuel_use_stationary_combustion'
    WHERE region = 'FR' and category = 'diesel' and preferred_source = 'Climatiq'
  `);

  await pool.query(`
    UPDATE emission_factor_mappings 
    SET activity_id = 'fuel-type_lpg-fuel_use_stationary_combustion'
    WHERE region = 'FR' and category = 'lpg' and preferred_source = 'Climatiq'
  `);
  
  console.log("\nDB updated for FR fuel fallback IDs.");
}

testClimatiq().then(() => process.exit(0)).catch(console.error);
