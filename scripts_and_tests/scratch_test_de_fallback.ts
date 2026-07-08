// Full 9-item Germany test calling service DIRECTLY - show full error details
import { processInvoiceEmissions } from "./src/services/InvoiceEmission.service.js";

const result = await processInvoiceEmissions({
  region: "DE",
  country_name: "Germany",
  invoice_year: null,
  items: [
    { item_name: "Petrol gasoline 100 litre",     category: "petrol",   value: 100, unit: "litre" },
    { item_name: "Road freight Berlin to Munich",  category: "freight",  value: 585, unit: "tonne-km" },
    { item_name: "Rail travel Berlin to Munich",   category: "railway",  value: 585, unit: "passenger-km" },
  ],
});

console.log(JSON.stringify(result.results, null, 2));
