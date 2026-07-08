import 'dotenv/config';
import { processInvoiceEmissions } from './src/services/InvoiceEmission.service.js';

async function main() {
    console.log("Running processInvoiceEmissions test for AU Electricity...");
    
    const input = {
        region: "AU",
        country_name: "Australia",
        invoice_year: 2024,
        invoice_text: "Electricity Victoria 1000 kWh - grid electricity - state supply address victoria",
        items: [
            {
                item_name: "Electricity Victoria",
                description: "grid electricity",
                category: "electricity",
                value: 1000,
                unit: "kWh",
                parameters: {}
            }
        ]
    };

    try {
        const result = await processInvoiceEmissions(input as any);
        console.log("\n--- TEST COMPLETE ---");
        console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
        console.error("Test failed:", e);
    }
    
    process.exit(0);
}

main();
