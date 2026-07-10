const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.join(process.cwd(), "src/services/reports");
const docxCountries = ["uk", "australia", "germany", "france", "usa", "malaysia"];

const countryMap = {
  "uk": "United Kingdom",
  "australia": "Australia",
  "germany": "Germany",
  "france": "France",
  "usa": "United States",
  "malaysia": "Malaysia"
};

function generateMapper(countryKey) {
  const countryName = countryMap[countryKey];
  return `export function buildReportData(data: any) {
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
    COUNTRY: "${countryName}",
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
import util from "util";
import libre from "libreoffice-convert";

const convertAsync = util.promisify(libre.convert);

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

  const docxBuf = doc.getZip().generate({
    type: "nodebuffer",
  });

  const generatedDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }

  const timestamp = Date.now();
  const docxPath = path.join(generatedDir, \`${country.toUpperCase()}_Report_\${timestamp}.docx\`);
  fs.writeFileSync(docxPath, docxBuf);

  let pdfPath = null;
  try {
    const pdfBuf = await convertAsync(docxBuf, ".pdf", undefined);
    pdfPath = path.join(generatedDir, \`${country.toUpperCase()}_Report_\${timestamp}.pdf\`);
    fs.writeFileSync(pdfPath, pdfBuf);
    console.log("[Timing] Successfully converted DOCX to PDF:", pdfPath);
    return { docxPath, pdfPath, reportUrl: pdfPath };
  } catch (err) {
    console.error("Failed to convert DOCX to PDF (is LibreOffice installed?):", err);
    return { docxPath, reportUrl: docxPath }; 
  }
}
`;
}

function processAll() {
  docxCountries.forEach(country => {
    const countryDir = path.join(REPORTS_DIR, country);
    fs.writeFileSync(path.join(countryDir, "mapper.ts"), generateMapper(country));
    fs.writeFileSync(path.join(countryDir, "generator.ts"), generateDocxGenerator(country));
  });
  console.log("Updated Mapper and Generator with libreoffice-convert and new placeholders.");
}

processAll();
