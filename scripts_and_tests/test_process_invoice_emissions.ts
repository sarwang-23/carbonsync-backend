import { processInvoiceEmissions } from "./src/services/InvoiceEmission.service.js";

async function run() {
    const result = await processInvoiceEmissions({
        region: "DE",
        country_name: "Germany",
        items: [
            {
                item_name: "heat supply",
                category: "district_heating",
                value: 1000,
                unit: "kWh"
            }
        ]
    });
    console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
