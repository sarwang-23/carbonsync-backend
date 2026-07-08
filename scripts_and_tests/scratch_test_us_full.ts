import 'dotenv/config';
import { processInvoiceEmissions } from './src/services/InvoiceEmission.service.js';

async function run() {
  const result = await processInvoiceEmissions({
    region: 'US',
    country_name: 'United States',
    invoice_year: 2024,
    items: [
      { item_name: 'Electricity consumption',  category: 'electricity',  value: 1000, unit: 'kWh' },
      { item_name: 'Natural Gas',              category: 'natural_gas',  value: 1000, unit: 'kWh' },
      { item_name: 'Diesel fuel',              category: 'diesel',       value: 100,  unit: 'litre' },
      { item_name: 'Petrol gasoline',          category: 'petrol',       value: 100,  unit: 'litre' },
      { item_name: 'LPG',                      category: 'lpg',          value: 100,  unit: 'litre' },
      { item_name: 'Coal',                     category: 'coal',         value: 1,    unit: 'tonne' },
      { item_name: 'Road Freight',             category: 'freight',      value: 500,  unit: 'tonne-km' },
      { item_name: 'Rail travel',              category: 'railway',      value: 350,  unit: 'passenger-km' },
      { item_name: 'Domestic flight New York to Chicago', category: 'flight', value: 1150, unit: 'passenger-km' },
    ]
  });

  console.log(`\n✅ Calculated: ${result.calculated_count}/${result.total_items}`);
  console.log(`❌ Review:     ${result.review_count}`);
  console.log(`💥 Failed:     ${result.failed_count}`);
  console.log(`📊 Total CO2e: ${result.total_co2e} ${result.total_co2e_unit}\n`);

  for (const r of result.results) {
    const status = r.status === 'calculated' ? '✅' : '❌';
    const co2e = r.co2e != null ? `${r.co2e} kg` : 'N/A';
    console.log(`${status} [${r.category}] ${r.item_name}`);
    console.log(`   Source: ${r.source_engine} | Factor: ${r.factor_name || r.reason} | CO2e: ${co2e}`);
    if (r.status !== 'calculated') console.log(`   Reason: ${r.reason} | Message: ${r.message}`);
    console.log('');
  }
}

run().catch(console.error);
