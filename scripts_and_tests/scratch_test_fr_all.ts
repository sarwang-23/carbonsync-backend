import { processInvoiceEmissions } from './src/services/InvoiceEmission.service.js';
import 'dotenv/config';

async function testFRAll() {
  console.log("Testing All Failing/Warned France Categories...");
  
  const result = await processInvoiceEmissions({
    region: 'FR',
    country_name: 'France',
    items: [
      {
        item_name: 'Petrol Fuel',
        category: 'petrol',
        value: 100, // Expected ~230-250 kg CO2e
        unit: 'litre'
      },
      {
        item_name: 'Natural Gas Usage',
        category: 'natural_gas',
        value: 1000, 
        unit: 'kWh'
      },
      {
        item_name: 'LPG Gas',
        category: 'lpg',
        value: 50,
        unit: 'litre'
      },
      {
        item_name: 'Coal',
        category: 'coal',
        value: 1, // Expected to convert to 1000 kg
        unit: 'tonne'
      },
      {
        item_name: 'Paris to Nice',
        category: 'flight',
        value: 685, 
        unit: 'km'
      }
    ]
  });

  console.log("\nResults:\n", JSON.stringify(result, null, 2));
}

testFRAll().then(() => process.exit(0)).catch(console.error);
