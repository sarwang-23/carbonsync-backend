import fs from "fs";
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
    console.warn("Template not found for germany:", templatePath);
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

  const outputPath = path.join(generatedDir, "GERMANY_Report_" + Date.now() + ".docx");
  fs.writeFileSync(outputPath, buf);

  return { docxPath: outputPath };
}
