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

const docxCountries = ["uk", "australia", "germany", "france", "usa", "malaysia"];

function generateMapper() {
  return `export function buildReportData(data: any) {
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
`;
}

function generateDocxGenerator(country) {
  return `import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { buildReportData } from "./mapper.js";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateReport(commonData: any) {
  const reportData = buildReportData(commonData);
  
  const templatePath = path.join(__dirname, "template.docx");
  
  if (!fs.existsSync(templatePath)) {
    console.warn("Template not found for ${country}:", templatePath);
    return null; 
  }

  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);
  
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(reportData);

  const buf = doc.getZip().generate({
    type: "nodebuffer",
  });

  const generatedDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }

  const outputPath = path.join(generatedDir, "${country.toUpperCase()}_Report_" + Date.now() + ".docx");
  fs.writeFileSync(outputPath, buf);

  return { docxPath: outputPath };
}
`;
}

function processAll() {
  docxCountries.forEach(country => {
    const countryDir = path.join(REPORTS_DIR, country);
    fs.writeFileSync(path.join(countryDir, "mapper.ts"), generateMapper());
    fs.writeFileSync(path.join(countryDir, "generator.ts"), generateDocxGenerator(country));
  });

  let routerImports = "import { generateReport as generateINReport } from './india/generator.js';\n";
  docxCountries.forEach(c => {
    const region = countries.find(x => x.name === c).region;
    routerImports += "import { generateReport as generate" + region + "Report } from './" + c + "/generator.js';\n";
  });

  const routerCode = routerImports + "\n" +
"export async function generateLocalReport(region: string, commonData: any): Promise<any> {\n" +
"  const normalizedRegion = (region || 'IN').toUpperCase();\n\n" +
"  switch (normalizedRegion) {\n" +
"    case 'IN': return { html: generateINReport(commonData) };\n" +
"    case 'GB':\n" +
"    case 'UK': return await generateUKReport(commonData);\n" +
"    case 'AU': return await generateAUReport(commonData);\n" +
"    case 'DE': return await generateDEReport(commonData);\n" +
"    case 'FR': return await generateFRReport(commonData);\n" +
"    case 'MY': return await generateMYReport(commonData);\n" +
"    case 'US': return await generateUSReport(commonData);\n" +
"    default: return { html: generateINReport(commonData) };\n" +
"  }\n" +
"}\n";

  fs.writeFileSync(path.join(REPORTS_DIR, "router.ts"), routerCode);
  console.log("Migration complete.");
}

processAll();
