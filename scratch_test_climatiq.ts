import { estimateWithClimatiq } from './src/services/climatiq.service.js';

async function testClimatiq() {
  const categories = ['natural_gas', 'petrol', 'lpg', 'diesel'];
  const activityIds = [
    'fuel_combustion-type_natural_gas-fuel_source_natural_gas',
    'fuel_combustion-type_petrol-fuel_source_motor_gasoline',
    'fuel_combustion-type_lpg-fuel_source_lpg',
    'fuel_combustion-type_diesel-fuel_source_diesel'
  ];

  for (const act of activityIds) {
    try {
      console.log(`\nTesting ${act} WITHOUT region...`);
      const res = await estimateWithClimatiq({
        selectedEF: {
          activity_id: act,
          year: 2024
        },
        parameters: { energy: 100, energy_unit: 'kWh', volume: 100, volume_unit: 'l' }
      });
      console.log(`Success! CO2e: ${res.data.co2e} ${res.data.co2e_unit}`);
    } catch (e: any) {
      console.log(`Failed! ${e.response?.data?.error_code || e.message}`);
    }
  }
}

testClimatiq().then(() => process.exit(0)).catch(console.error);
