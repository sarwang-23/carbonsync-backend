import { calculateDynamicCountryEmission } from "./src/services/dynamicEmissionFactor.service.js";

async function run() {
    const items = [
        { item_name: "Coke Breeze", quantity: 3, unit: "MT" },
        { item_name: "Limestone", quantity: 4, unit: "MT" }
    ];

    for (const item of items) {
        console.log(`\nTesting ${item.item_name}...`);
        try {
            const result = await calculateDynamicCountryEmission(item, "india invoice test", "invoice.pdf");
            console.log(JSON.stringify(result, null, 2));
        } catch (e: any) {
            console.error(`ERROR: ${e.message}`);
        }
    }
}
run();
