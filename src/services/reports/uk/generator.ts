import fs from "fs";
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

// ─── Phase 1: Template Read Test ────────────────────────────────────────────
export async function testTemplateRead() {
  const templatePath = path.join(__dirname, "template.docx");

  if (!fs.existsSync(templatePath)) {
    throw new Error(`UK template not found at: ${templatePath}`);
  }

  const stats = fs.statSync(templatePath);
  console.log("✅ UK Template Found:", templatePath);

  return {
    found: true,
    templatePath,
    sizeBytes: stats.size,
    sizeMB: (stats.size / 1024 / 1024).toFixed(2) + " MB",
  };
}

// ─── Phase 2-5: Full Report Generation ──────────────────────────────────────
export async function generateReport(commonData: any) {
  const reportData = buildReportData(commonData);
  
  const templatePath = path.join(__dirname, "template.docx");
  
  if (!fs.existsSync(templatePath)) {
    console.warn("Template not found for uk:", templatePath);
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
  const docxPath = path.join(generatedDir, `UK_Report_${timestamp}.docx`);
  fs.writeFileSync(docxPath, docxBuf);

  let pdfPath = null;
  try {
    const pdfBuf = await convertAsync(docxBuf, ".pdf", undefined);
    pdfPath = path.join(generatedDir, `UK_Report_${timestamp}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuf);
    console.log("[Timing] Successfully converted DOCX to PDF:", pdfPath);
    return { docxPath, pdfPath, reportUrl: pdfPath };
  } catch (err) {
    console.error("Failed to convert DOCX to PDF (is LibreOffice installed?):", err);
    return { docxPath, reportUrl: docxPath }; 
  }
}
