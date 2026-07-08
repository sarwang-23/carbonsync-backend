import { processInvoiceEmissions } from "./src/services/InvoiceEmission.service.js";

async function run() {
    console.log("=== Full India Steel Invoice Test ===\n");
    
    const items = [
        { item_name: "Coke Breeze",        category: "coke",       value: 3, unit: "MT" },
        { item_name: "Limestone",           category: "limestone",  value: 4, unit: "MT" },
        { item_name: "Ferro Silicon (70%)", category: "ferro_alloy",value: 1, unit: "MT" },
        { item_name: "Iron Ore Fines",      category: "iron_ore",   value: 5, unit: "MT" },
        // Rescue test: unknown category
        { item_name: "Coke Breeze",         category: "unknown",    value: 2, unit: "MT" },
        { item_name: "M S TMT Bars 12 mm",  category: "unknown",    value: 10, unit: "MT" },
    ];

    const result = await processInvoiceEmissions({
        region: "IN",
        country_name: "India",
        items,
    } as any);

    console.log(`\nTotal CO2e: ${result.total_co2e} kg`);
    console.log(`Calculated: ${result.calculated_count} | Review: ${result.review_count} | Failed: ${result.failed_count}\n`);

    for (const r of result.results) {
        const icon = r.status === "calculated" ? "✅" : r.status === "review" ? "⚠️" : "❌";
        console.log(`${icon} ${r.item_name}`);
        console.log(`   category: ${r.category} | status: ${r.status} | co2e: ${r.co2e ?? "—"} kg`);
        if (r.reason) console.log(`   reason: ${r.reason} — ${r.message}`);
        console.log();
    }
}
run().catch(console.error);
