import 'dotenv/config';
import { estimateWithClimatiq } from './src/services/climatiq.service.js';

async function test() {
  const ids = [
    'fuel-type_lpg-fuel_use_stationary',
    'passenger_flight-route_type_domestic-aircraft_type_na-distance_na-class_na-rf_included-distance_uplift_included',
    'passenger_flight-route_type_na-aircraft_type_na-distance_na-class_economy-rf_included-distance_uplift_included'
  ];

  for (const act of ids) {
    try {
      console.log(`\nTesting ${act}...`);
      const res = await estimateWithClimatiq({
        selectedEF: { activity_id: act, year: 2024 },
        parameters: { volume: 50, volume_unit: 'l', passengers: 1, distance: 685, distance_unit: 'km' }
      });
      console.log(`Success! CO2e: ${res.data.co2e} ${res.data.co2e_unit} | Factor: ${res.data.emission_factor.name} | Region: ${res.data.emission_factor.region}`);
    } catch (e: any) {
      console.log(`Failed! ${e.response?.data?.error_code || e.message}`);
    }
  }
}

test().then(() => process.exit(0)).catch(console.error);
