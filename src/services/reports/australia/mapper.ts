export function buildReportData(data: any) {
  return {
    COMPANY_NAME: "CarbonSynq Demo Client",
    REPORT_YEAR: new Date().getFullYear(),
    REPORTING_PERIOD: "Invoice Based",
    SCOPE1: data.scope1 || 0,
    SCOPE2: data.scope2 || 0,
    SCOPE3: data.scope3 || 0,
    TOTAL_CO2E: data.totalKgCO2e || 0,
    TOTAL_TCO2E: data.totalTCO2e || 0,
    ELECTRICITY: data.extractedItems?.find((x: any) => String(x.item_name).toLowerCase().includes("electricity"))?.quantity || 0,
    NATURAL_GAS: data.extractedItems?.find((x: any) => String(x.item_name).toLowerCase().includes("natural gas"))?.quantity || 0,
    BUSINESS_TRAVEL: 0,
    RECOMMENDATION: "Optimize energy consumption",
    CEO_NAME: "CEO Name"
  };
}
