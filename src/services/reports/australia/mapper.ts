export function buildReportData(data: any) {
  return {
    COMPANY_NAME: data.company?.name || "CarbonSynq Demo Client",
    REPORT_YEAR: new Date().getFullYear(),
    REPORT_DATE: new Date().toLocaleDateString(),
    SCOPE1: data.scope1 || 0,
    SCOPE2: data.scope2 || 0,
    SCOPE3: data.scope3 || 0,
    TOTAL_CO2E: data.totalKgCO2e || 0,
    TOTAL_TCO2E: data.totalTCO2e || 0,
    ELECTRICITY: data.extractedItems?.find((x: any) => String(x.item_name).toLowerCase().includes("electricity"))?.quantity || 0,
    NATURAL_GAS: data.extractedItems?.find((x: any) => String(x.item_name).toLowerCase().includes("natural gas"))?.quantity || 0,
    DIESEL: data.extractedItems?.find((x: any) => String(x.item_name).toLowerCase().includes("diesel"))?.quantity || 0,
    COUNTRY: "Australia",
    RECOMMENDATION: "Optimize energy consumption",
    CEO_NAME: "CEO Name"
  };
}
