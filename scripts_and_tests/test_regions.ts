import 'dotenv/config';
import { calculateDynamicCountryEmission } from './src/services/dynamicEmissionFactor.service.js';

async function testAll() {
  const regions = [
    { name: 'IN', text: '₹ electricity bill adani electricity 1000 kwh' },
    { name: 'MY', text: 'rm tenaga nasional berhad bil elektrik 1000 kwh' },
    { name: 'DE', text: 'eur stromrechnung deutschland 1000 kwh' },
    { name: 'US', text: 'usd united states electricity bill 1000 kwh' },
    { name: 'GB', text: 'gbp united kingdom £ electricity bill 1000 kwh' },
    { name: 'FR', text: 'eur france tva electricity bill 1000 kwh' },
    { name: 'AU', text: 'aud australia abn electricity bill 1000 kwh' },
  ];

  for (const r of regions) {
    console.log(`\nTesting Region: ${r.name}`);
    try {
      const res = await calculateDynamicCountryEmission(
        { item_name: 'electricity', quantity: 1000, unit: 'kWh' },
        r.text,
        ''
      );
      console.log(`Success: ${res.success} | Region detected: ${res.country} | Category: ${res.category} | Engine: ${res.mapping?.mapping_type || res.source_engine}`);
    } catch (e: any) {
      console.log(`Error testing ${r.name}: ${e.message}`);
    }
  }
}

testAll().then(() => process.exit(0));
