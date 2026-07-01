import 'dotenv/config';
import { estimateWithClimatiq } from './src/services/climatiq.service.js';

async function test() {
  try {
    const res = await estimateWithClimatiq({
      selectedEF: { activity_id: 'fuel-type_natural_gas-fuel_use_stationary_combustion' },
      parameters: { volume: 1500, volume_unit: 'm3' }
    });
    console.log(res.data);
  } catch (e: any) {
    console.log(e.response?.data);
  }
}

test().then(() => process.exit(0));
