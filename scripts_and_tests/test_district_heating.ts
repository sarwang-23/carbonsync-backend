import { calculateDynamicCountryEmission } from "./src/services/dynamicEmissionFactor.service.js";

async function run() {
    const result = await calculateDynamicCountryEmission(
        {
            item_name: "heat supply",
            description: "heat supply",
            quantity: 1000,
            unit: "kWh"
        },
        "Fernwärme DE_03_district_heating",
        "DE_03_district_heating.pdf"
    );
    console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
