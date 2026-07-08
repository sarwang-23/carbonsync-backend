import 'dotenv/config';
import { estimateWithClimatiq } from './src/services/climatiq.service.js';

async function run() {
  const result = await estimateWithClimatiq({
    selectedEF: {
      activity_id: 'freight_vehicle-vehicle_type_hgv-fuel_source_diesel-vehicle_weight_na-percentage_load_avg',
      year: 2024,
    },
    parameters: {
      weight: 500,
      weight_unit: 'tonne',
      distance: 1,
      distance_unit: 'km'
    }
  });

  console.log("Result:", result.data);
}

run().catch(console.error);
