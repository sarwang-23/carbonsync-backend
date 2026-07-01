import { processInvoiceEmissions } from './src/services/InvoiceEmission.service.js';

async function testFR() {
  console.log("Testing France Invoice...");
  
  const result = await processInvoiceEmissions({
    region: 'FR',
    country_name: 'France',
    items: [
      {
        item_name: 'Facture gaz',
        category: 'natural_gas',
        value: 1500,
        unit: 'kWh'
      },
      {
        item_name: 'Essence',
        category: 'petrol',
        value: 50,
        unit: 'litre'
      }
    ]
  });

  console.log("\nResults:\n", JSON.stringify(result, null, 2));
}

testFR().then(() => process.exit(0)).catch(console.error);
