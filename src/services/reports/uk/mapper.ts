export function buildUKReportData(commonData?: any) {
  // If commonData is not provided (like in local tests), use fallback dummy data
  const safeData = commonData || {};
  
  // Format numbers to keep 2-4 decimal places like India report
  const formatNum = (val: any, digits = 2) => Number(val || 0).toFixed(digits);

  return {
    COMPANY_NAME: safeData.companyName || "CarbonSynq Demo Client",
    REPORT_YEAR: new Date().getFullYear().toString(),
    REPORT_DATE: safeData.currentDate || new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    TOTAL_CO2E: formatNum(safeData.totalKgCO2e || 0, 2),
    TOTAL_TCO2E: formatNum(safeData.totalTCO2e || 0, 4),
    SCOPE1: formatNum(safeData.scope1 || 0, 2),
    SCOPE2: formatNum(safeData.scope2 || 0, 4),
    SCOPE3: formatNum(safeData.scope3 || 0, 4),
    ELECTRICITY: formatNum(safeData.electricity || 0, 2),
    NATURAL_GAS: formatNum(safeData.naturalGas || 0, 2),
    DIESEL: formatNum(safeData.diesel || 0, 2),
    COUNTRY: "United Kingdom",
    RECOMMENDATION: "Optimize energy consumption and switch to renewable sources.",
    CEO_NAME: "CEO Name"
  };
}
