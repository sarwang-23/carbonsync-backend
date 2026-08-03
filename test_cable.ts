import { processInvoiceEmissions } from "./src/services/InvoiceEmission.service.js";
import { normalizeInvoiceItems } from "./src/services/InvoiceItemNormalize.service.js";

async function run() {
  console.log("=== Testing 'Electrical Cable' Item ===\n");
  
  const rawItems = [
    { name: "Electrical Cable", quantity: 18500, unit: "kWh" }
  ];

  // 1. First see how normalizeInvoiceItems handles it
  const normalized = normalizeInvoiceItems(rawItems as any, "Unknown Vendor", "Electrical Cable 18500 kWh");
  console.log("Normalized Item:", normalized[0]);

  // 2. See how emission service handles it (Region GB)
  const resultGB = await processInvoiceEmissions({
    region: "GB",
    country_name: "Great Britain",
    invoice_year: 2024,
    currency: "GBP",
    items: normalized,
  } as any);

  console.log("\nGB Emission Result:");
  console.log(`Total CO2e: ${resultGB.total_co2e}`);
  console.log(`Calculated: ${resultGB.calculated_count}`);
  console.log(`Results:`, JSON.stringify(resultGB.results, null, 2));

  // 3. See how emission service handles it (Region IN)
  const resultIN = await processInvoiceEmissions({
    region: "IN",
    country_name: "India",
    invoice_year: 2024,
    currency: "INR",
    items: normalized,
  } as any);

  console.log("\nIN Emission Result:");
  console.log(`Total CO2e: ${resultIN.total_co2e}`);
  console.log(`Calculated: ${resultIN.calculated_count}`);
  console.log(`Results:`, JSON.stringify(resultIN.results, null, 2));

}

run().catch(console.error);
