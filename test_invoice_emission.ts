// Full simulation: Mistral se aaye items jisme category nahi hai ya unknown hai
// Production scenario: real invoice se extract hue items
import { processInvoiceEmissions } from "./src/services/InvoiceEmission.service.js";

async function run() {
    console.log("=== TEST 1: Items with category already set (normal flow) ===\n");
    const result1 = await processInvoiceEmissions({
        region: "IN",
        country_name: "India",
        items: [
            { item_name: "Coke Breeze", category: "coke", value: 3, unit: "MT" },
            { item_name: "Limestone", category: "limestone", value: 4, unit: "MT" },
        ]
    } as any);
    console.log("Test 1 results:", result1.results.map((r: any) => ({
        item: r.item_name, status: r.status, co2e: r.co2e, category: r.category
    })));

    console.log("\n=== TEST 2: Items with category = 'unknown' (rescue flow) ===\n");
    const result2 = await processInvoiceEmissions({
        region: "IN",
        country_name: "India",
        items: [
            { item_name: "Coke Breeze", category: "unknown", value: 3, unit: "MT" },
            { item_name: "Limestone", category: "unknown", value: 4, unit: "MT" },
            { item_name: "M S TMT Bars 12 mm", category: "unknown", value: 10, unit: "MT" },
        ]
    } as any);
    console.log("Test 2 results:", result2.results.map((r: any) => ({
        item: r.item_name, status: r.status, co2e: r.co2e, category: r.category
    })));

    console.log("\n=== TEST 3: Items with no category field (missing) ===\n");
    const result3 = await processInvoiceEmissions({
        region: "IN",
        country_name: "India",
        items: [
            { item_name: "Coke Breeze", value: 3, unit: "MT" },
            { item_name: "Limestone", value: 4, unit: "MT" },
        ]
    } as any);
    console.log("Test 3 results:", result3.results.map((r: any) => ({
        item: r.item_name, status: r.status, co2e: r.co2e, category: r.category
    })));
}
run().catch(console.error);
