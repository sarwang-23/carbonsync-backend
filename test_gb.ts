import { processInvoiceEmissions } from "./src/services/InvoiceEmission.service.js";

async function testGB() {
  const input = {
    region: "GB",
    country_name: "Great Britain",
    invoice_year: 2024,
    invoice_text: "electricity invoice for some company",
    currency: "GBP",
    items: [
      {
        item_name: "Electricity charges",
        category: "electricity",
        value: 1000,
        unit: "kWh",
        amount: 200
      }
    ]
  };

  const result = await processInvoiceEmissions(input);
  console.log(JSON.stringify(result, null, 2));
}

testGB().catch(console.error);
