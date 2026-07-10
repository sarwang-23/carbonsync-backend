const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.join(process.cwd(), "src/services/reports");

const countries = [
  { name: "uk", region: "UK" },
  { name: "australia", region: "AU" },
  { name: "germany", region: "DE" },
  { name: "france", region: "FR" },
  { name: "usa", region: "US" },
  { name: "malaysia", region: "MY" }
];

function generateFinalTemplate(rawHtml) {
  // Replace hardcoded values with template variables
  let processedHtml = rawHtml
    .replace(/0\.0000/g, "${formatNumber(scope1, 4)}")
    .replace(/0\.1999/g, "${formatNumber(scope2, 4)}")
    .replace(/281\.56/g, "${formatNumber(totalTCO2e, 2)}")
    .replace(/10 July 2026/g, "${currentDate}");
    
  return `export function generateReport(commonData: any) {
  const {
    file, extractedItems, calculationResults, totalKgCO2e, totalTCO2e,
    successful, failed, dataQuality, documentLabel,
    scope1, scope2, scope3, scope3ReportLabel, scope3Description, scopeCategorySummary,
    currentDate, rows, itemRows
  } = commonData;

  function formatNumber(value: any, digits = 2) {
    return Number(value || 0).toFixed(digits);
  }

  function truncateNumber(value: any, digits = 5) {
    const num = Number(value || 0);
    const factor = Math.pow(10, digits);
    return (Math.trunc(num * factor) / factor).toFixed(digits);
  }

  return \`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Inter', Arial, sans-serif; color: #1f2937; background: #f8fafc; padding: 40px; }
    h1 { font-size: 24px; color: #146c43; margin-top: 40px; margin-bottom: 10px; border-bottom: 2px solid #18864b; padding-bottom: 5px; }
    h2 { font-size: 18px; color: #18864b; margin-top: 20px; }
    h3 { font-size: 14px; color: #374151; font-weight: 600; }
    p { font-size: 12px; line-height: 1.6; color: #4b5563; }
    ol, ul { font-size: 12px; line-height: 1.6; color: #4b5563; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 15px; margin-bottom: 25px; font-size: 10px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    th, td { border-bottom: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; padding: 10px; text-align: left; vertical-align: top; }
    td:last-child { border-right: none; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #f9fafb; }
    strong { color: #111827; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  \${ \`${processedHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/\\\$\{/g, '${')}\` }
</body>
</html>\`;
}
`;
}

function processAll() {
  countries.forEach(country => {
    const rawPath = path.join(REPORTS_DIR, country.name, "raw_template.html");
    const genPath = path.join(REPORTS_DIR, country.name, "generator.ts");
    
    if (fs.existsSync(rawPath)) {
      const rawHtml = fs.readFileSync(rawPath, "utf-8");
      const finalCode = generateFinalTemplate(rawHtml);
      fs.writeFileSync(genPath, finalCode);
      console.log(`Updated generator for ${country.name}`);
    }
  });
}

processAll();
