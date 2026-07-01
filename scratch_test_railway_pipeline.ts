import 'dotenv/config';
import { processInvoiceEmissions } from './src/services/InvoiceEmission.service.js';

async function run() {
  const result = await processInvoiceEmissions({
    region: 'GB',
    country_name: 'United Kingdom',
    items: [
      {
        item_name: 'Rail travel',
        category: 'railway',
        value: 350,
        unit: 'passenger-km'
      }
    ]
  });

  console.log(JSON.stringify(result, null, 2));
}

run();
