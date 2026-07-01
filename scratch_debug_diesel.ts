import 'dotenv/config';
import axios from 'axios';
import { estimateWithClimatiq } from './src/services/climatiq.service.js';

async function search() {
  // 1. Search for correct diesel combustion activities
  console.log("=== Searching for diesel stationary combustion ===");
  const res = await axios.get('https://api.climatiq.io/data/v1/search', {
    headers: { Authorization: `Bearer ${process.env.CLIMATIQ_API_KEY}` },
    params: {
      query: 'diesel distillate fuel stationary combustion',
      data_version: '^6',
      results_per_page: 10
    }
  });

  for (const r of res.data.results) {
    console.log(`ID: ${r.activity_id}`);
    console.log(`  Name: ${r.name} | Source: ${r.source} (${r.region}) | Unit: ${r.unit_type}`);
  }

  // 2. Test the candidates directly
  const candidates = [
    'fuel-type_diesel-fuel_use_stationary',
    'fuel-type_gas_diesel_oil-fuel_use_stationary', 
    'fuel-type_diesel-fuel_use_mobile',
    'fuel-type_distillate_fuel_oil_number_2-fuel_use_stationary'
  ];

  console.log("\n=== Testing candidates with 100L diesel ===");
  for (const id of candidates) {
    try {
      const r = await estimateWithClimatiq({
        selectedEF: { activity_id: id },
        parameters: { volume: 100, volume_unit: 'l' }
      });
      const ef = r.data.emission_factor;
      console.log(`\n✅ ${id}`);
      console.log(`   CO2e: ${r.data.co2e} ${r.data.co2e_unit}`);
      console.log(`   Factor name: ${ef.name}`);
      console.log(`   Source: ${ef.source} (${ef.region})`);
    } catch (e: any) {
      console.log(`❌ ${id}: ${e.response?.data?.error_code || e.message}`);
    }
  }
}

search().then(() => process.exit(0)).catch(console.error);
