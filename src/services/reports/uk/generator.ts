import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { buildUKReportData } from "./mapper.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Phase 1: Template existence check ──────────────────────────────────────
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

// ─── Phase 2: Generate UK Report DOCX ───────────────────────────────────────
export async function generateUKReport() {
  const templatePath = path.join(
    process.cwd(),
    "src",
    "services",
    "reports",
    "uk",
    "template.docx"
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`UK template not found at: ${templatePath}`);
  }

  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  const reportData = buildUKReportData();
  doc.render(reportData);

  const buffer = doc.getZip().generate({
    type: "nodebuffer",
  });

  // Ensure generated/ folder exists
  const generatedDir = path.join(process.cwd(), "generated");
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }

  const outputPath = path.join(generatedDir, "UK_Report.docx");
  fs.writeFileSync(outputPath, buffer);

  console.log("✅ UK Report generated:", outputPath);
  return outputPath;
}

// ─── Full generation with real emission data (used by main pipeline) ─────────
export async function generateReport(commonData: any) {
  // In Phase 2 we use dummy data; later mapper will use commonData
  return generateUKReport();
}
