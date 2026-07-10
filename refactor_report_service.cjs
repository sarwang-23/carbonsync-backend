const fs = require("fs");
const path = require("path");

const servicePath = path.join(process.cwd(), "src/services/Report.service.ts");
let content = fs.readFileSync(servicePath, "utf-8");

// Add router import at the top
if (!content.includes('import { generateLocalReportHtml } from "./reports/router.js";')) {
  // Find the last import and insert after it
  const lines = content.split('\n');
  const lastImportIndex = lines.reduce((acc, line, i) => line.startsWith('import ') ? i : acc, 0);
  lines.splice(lastImportIndex + 1, 0, 'import { generateLocalReportHtml } from "./reports/router.js";');
  content = lines.join('\n');
}

// 1. Replace buildBRSRHtml definition with buildCommonData
const htmlStartStr = `  return \`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * {
      box-sizing: border-box;`;

// Find where buildBRSRHtml starts
const funcStart = content.indexOf("function buildBRSRHtml(payload: any) {");
if (funcStart !== -1) {
  content = content.replace("function buildBRSRHtml(payload: any) {", "export function buildCommonData(payload: any) {");
  
  // Find where the HTML string starts
  const htmlStart = content.indexOf(htmlStartStr);
  
  if (htmlStart !== -1) {
    // Find the end of buildBRSRHtml (it ends with </html>\`;\n})
    const htmlEndStr = "</html>\`;\n}";
    const htmlEnd = content.indexOf(htmlEndStr, htmlStart) + htmlEndStr.length;
    
    const returnObj = `  return {
    file, extractedItems, calculationResults, totalKgCO2e, totalTCO2e,
    successful, failed, dataQuality, documentLabel,
    scope1, scope2, scope3, scope3ReportLabel, scope3Description, scopeCategorySummary,
    currentDate, rows, itemRows
  };
}`;
    
    content = content.substring(0, htmlStart) + returnObj + content.substring(htmlEnd);
  }
}

// 2. Modify generateInvoiceEmissionReports
// From: const brsrHtml = buildBRSRHtml(safePayload);
// To: const commonData = buildCommonData(safePayload); const region = safePayload.region || safePayload.calculationResults?.[0]?.region || "IN"; const brsrHtml = generateLocalReportHtml(region, commonData);

const oldLines = `    const brsrHtml = buildBRSRHtml(safePayload);`;
const newLines = `    const commonData = buildCommonData(safePayload);
    const region = safePayload.region || safePayload.calculationResults?.[0]?.region || "IN";
    const brsrHtml = generateLocalReportHtml(region, commonData);`;

content = content.replace(oldLines, newLines);

fs.writeFileSync(servicePath, content);
console.log("Refactoring complete");
