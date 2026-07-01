import { processInvoiceEmissions } from './src/services/InvoiceEmission.service.js';
import 'dotenv/config';

async function testDiesel() {
  console.log("Testing FR Diesel: 100 litres (Expected ~260-270 kg CO2e)\n");

  const result = await processInvoiceEmissions({
    region: 'FR',
    country_name: 'France',
    items: [
      {
        item_name: 'Diesel fuel gazole',
        category: 'diesel',
        value: 100,
        unit: 'litre'
      },
      {
        item_name: 'Biodiesel B100',  // This SHOULD select Biodiesel
        category: 'diesel',
        value: 100,
        unit: 'litre'
      }
    ]
  });

  for (const r of result.results) {
    console.log(`\n📦 ${r.item_name}`);
    console.log(`   Status: ${r.status}`);
    if (r.status === 'calculated') {
      console.log(`   CO2e: ${r.co2e} ${r.co2e_unit}`);
      console.log(`   Factor: ${r.factor_name}`);
      console.log(`   Source: ${r.factor_source} (${r.factor_region})`);
      console.log(`   Activity: ${r.activity_id}`);
    } else {
      console.log(`   Reason: ${r.reason}`);
      console.log(`   Message: ${r.message}`);
    }
  }
}

testDiesel().then(() => process.exit(0)).catch(console.error);
