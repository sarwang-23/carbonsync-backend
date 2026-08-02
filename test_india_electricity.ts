import { processInvoiceEmissions } from "./src/services/InvoiceEmission.service.js";

async function testIndiaElectricity() {
  console.log("=== India Electricity Bill Test ===\n");

  const result = await processInvoiceEmissions({
    region: "IN",
    country_name: "India",
    invoice_year: 2024,
    invoice_text: "electricity bill for Maharashtra MSEDCL consumer units consumed 850 kWh",
    currency: "INR",
    items: [
      {
        item_name: "Electricity Charges",
        category: "electricity",
        value: 850,
        unit: "kWh",
        amount: 7500,
      },
    ],
  } as any);

  console.log(`Total CO2e    : ${result.total_co2e} kg`);
  console.log(`Total tCO2e   : ${Number((result.total_co2e / 1000).toFixed(6))} tCO2e`);
  console.log(`Calculated    : ${result.calculated_count}`);
  console.log(`Review        : ${result.review_count}`);
  console.log(`Failed        : ${result.failed_count}`);
  console.log();

  for (const r of result.results) {
    const icon = r.status === "calculated" ? "✅" : r.status === "review" ? "⚠️" : "❌";
    console.log(`${icon} ${r.item_name}`);
    console.log(`   category       : ${r.category}`);
    console.log(`   status         : ${r.status}`);
    console.log(`   co2e           : ${r.co2e ?? "—"} kg`);
    console.log(`   source_engine  : ${r.source_engine ?? "—"}`);
    console.log(`   factor_name    : ${r.factor_name ?? "—"}`);
    console.log(`   factor_value   : ${r.factor_value ?? "—"}`);
    if (r.reason) console.log(`   reason         : ${r.reason} — ${r.message}`);
    console.log();
  }
}

async function testIndiaDiesel() {
  console.log("=== India Diesel Invoice Test ===\n");

  const result = await processInvoiceEmissions({
    region: "IN",
    country_name: "India",
    invoice_year: 2024,
    currency: "INR",
    items: [
      {
        item_name: "High Speed Diesel (HSD)",
        category: "diesel",
        value: 500,
        unit: "litre",
        amount: 45000,
      },
    ],
  } as any);

  console.log(`Total CO2e    : ${result.total_co2e} kg`);
  console.log(`Total tCO2e   : ${Number((result.total_co2e / 1000).toFixed(6))} tCO2e`);
  console.log();

  for (const r of result.results) {
    const icon = r.status === "calculated" ? "✅" : r.status === "review" ? "⚠️" : "❌";
    console.log(`${icon} ${r.item_name}`);
    console.log(`   status         : ${r.status}`);
    console.log(`   co2e           : ${r.co2e ?? "—"} kg`);
    console.log(`   source_engine  : ${r.source_engine ?? "—"}`);
    console.log(`   factor_name    : ${r.factor_name ?? "—"}`);
    if (r.reason) console.log(`   reason         : ${r.reason}`);
    console.log();
  }
}

async function testIndiaNaturalGas() {
  console.log("=== India Natural Gas Invoice Test ===\n");

  const result = await processInvoiceEmissions({
    region: "IN",
    country_name: "India",
    invoice_year: 2024,
    currency: "INR",
    items: [
      {
        item_name: "PNG Natural Gas",
        category: "natural_gas",
        value: 200,
        unit: "scm",
        amount: 14000,
      },
    ],
  } as any);

  console.log(`Total CO2e    : ${result.total_co2e} kg`);
  console.log(`Total tCO2e   : ${Number((result.total_co2e / 1000).toFixed(6))} tCO2e`);
  console.log();

  for (const r of result.results) {
    const icon = r.status === "calculated" ? "✅" : r.status === "review" ? "⚠️" : "❌";
    console.log(`${icon} ${r.item_name}`);
    console.log(`   status         : ${r.status}`);
    console.log(`   co2e           : ${r.co2e ?? "—"} kg`);
    console.log(`   source_engine  : ${r.source_engine ?? "—"}`);
    console.log(`   factor_name    : ${r.factor_name ?? "—"}`);
    if (r.reason) console.log(`   reason         : ${r.reason}`);
    console.log();
  }
}

async function testIndiaMixed() {
  console.log("=== India Mixed Invoice Test (Electricity + Diesel + Steel) ===\n");

  const result = await processInvoiceEmissions({
    region: "IN",
    country_name: "India",
    invoice_year: 2024,
    invoice_text: "industrial invoice electricity units consumed 1200 kWh diesel HSD 300 litre",
    currency: "INR",
    items: [
      { item_name: "Electricity Units",     category: "electricity",  value: 1200, unit: "kWh",    amount: 10000 },
      { item_name: "HSD Diesel",            category: "diesel",       value: 300,  unit: "litre",  amount: 27000 },
      { item_name: "M S TMT Bars 12 mm",    category: "unknown",      value: 10,   unit: "MT",     amount: 650000 },
      { item_name: "Coke Breeze",           category: "coke",         value: 5,    unit: "MT",     amount: 40000 },
      { item_name: "GST 18%",              category: "unknown",      value: 0,    unit: "",       amount: 12000 },
    ],
  } as any);

  console.log(`Total CO2e    : ${result.total_co2e} kg`);
  console.log(`Total tCO2e   : ${Number((result.total_co2e / 1000).toFixed(6))} tCO2e`);
  console.log(`Calculated    : ${result.calculated_count} | Review: ${result.review_count} | Ignored: —`);
  console.log();

  for (const r of result.results) {
    const icon = r.status === "calculated" ? "✅" : r.status === "review" ? "⚠️" : r.status === "ignored" ? "🔕" : "❌";
    console.log(`${icon} ${r.item_name}`);
    console.log(`   category       : ${r.category}`);
    console.log(`   status         : ${r.status}`);
    console.log(`   co2e           : ${r.co2e ?? "—"} kg`);
    console.log(`   source_engine  : ${r.source_engine ?? "—"}`);
    if (r.reason) console.log(`   reason         : ${r.reason}`);
    console.log();
  }
}

(async () => {
  await testIndiaElectricity();
  await testIndiaDiesel();
  await testIndiaNaturalGas();
  await testIndiaMixed();
})().catch(console.error);
