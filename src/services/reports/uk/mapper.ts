export function buildUKReportData(commonData?: any) {
  // If commonData is not provided (like in local tests), use fallback dummy data
  const safeData = commonData || {};
  
  // Extract results
  const results = safeData.calculationResults || [];
  const successful = results.filter((r: any) => r.success);

  let scope1 = 0;
  let scope2 = 0;
  let scope3 = 0;
  let electricity = 0;
  let naturalGas = 0;
  let diesel = 0;

  for (const item of successful) {
    const tco2e = Number(item.result?.total_tco2e || 0);
    const category = String(item.result?.category || "").toLowerCase();
    const itemName = String(item.item_name || "").toLowerCase();
    const activityId = String(item.result?.activity_id || "").toLowerCase();
    
    // Electricity -> Scope 2
    if (itemName.includes("electricity") || category.includes("electricity") || activityId.includes("electricity")) {
      scope2 += tco2e;
      electricity += tco2e;
    }
    // Natural Gas -> Scope 1
    else if (itemName.includes("gas") || category.includes("gas") || activityId.includes("gas")) {
      scope1 += tco2e;
      naturalGas += tco2e;
    }
    // Diesel / Fuel -> Scope 1
    else if (itemName.includes("diesel") || category.includes("diesel") || category.includes("fuel")) {
      scope1 += tco2e;
      diesel += tco2e;
    }
    // Default fallback to Scope 3 (purchased goods, transport, etc)
    else {
      scope3 += tco2e;
    }
  }

  // Calculate totals if missing
  const totalKg = safeData.totalKgCO2e || successful.reduce((sum: number, r: any) => sum + Number(r.result?.co2e || 0), 0);
  const totalTco2e = safeData.totalTCO2e || successful.reduce((sum: number, r: any) => sum + Number(r.result?.total_tco2e || 0), 0);

  // Format numbers to keep 2-4 decimal places like India report
  const formatNum = (val: any, digits = 2) => Number(val || 0).toFixed(digits);

  return {
    COMPANY_NAME: safeData.companyName || "CarbonSynq Demo Client",
    REPORT_YEAR: new Date().getFullYear().toString(),
    REPORT_DATE: safeData.currentDate || new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    TOTAL_CO2E: formatNum(totalKg, 2),
    TOTAL_TCO2E: formatNum(totalTco2e, 4),
    SCOPE1: formatNum(scope1, 2),
    SCOPE2: formatNum(scope2, 4),
    SCOPE3: formatNum(scope3, 4),
    ELECTRICITY: formatNum(electricity, 2),
    NATURAL_GAS: formatNum(naturalGas, 2),
    DIESEL: formatNum(diesel, 2),
    COUNTRY: "United Kingdom",
    RECOMMENDATION: "Optimize energy consumption and switch to renewable sources.",
    CEO_NAME: "CEO Name"
  };
}
