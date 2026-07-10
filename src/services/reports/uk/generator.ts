import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { buildUKReportData } from "./mapper.js";
import { fileURLToPath } from "url";
import util from "util";
import libre from "libreoffice-convert";

const convertAsync = util.promisify(libre.convert);

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
export async function generateUKReport(commonData?: any) {
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

  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const reportData = buildUKReportData(commonData);
    doc.render(reportData);

  } catch (error: any) {
    console.error("=== DOCXTEMPLATER ERROR ===");
    if (error.properties?.errors) {
      error.properties.errors.forEach((e: any, i: number) => {
        console.error(`[${i}]`, JSON.stringify(e.properties, null, 2));
      });
    } else {
      console.error(JSON.stringify(error.properties, null, 2));
    }
    console.error("===========================");
    throw error;
  }

  const buffer = doc!.getZip().generate({
    type: "nodebuffer",
  });

  // Ensure reports/ folder exists (Express serves this statically)
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = Date.now();
  const docxFilename = `UK_Report_${timestamp}.docx`;
  const outputPath = path.join(reportsDir, docxFilename);
  fs.writeFileSync(outputPath, buffer);

  console.log("✅ UK Report DOCX generated:", outputPath);

  // Convert to PDF
  const pdfFilename = `UK_Report_${timestamp}.pdf`;
  const pdfOutputPath = path.join(reportsDir, pdfFilename);
  try {
    const pdfBuf = await convertAsync(buffer, ".pdf", undefined);
    fs.writeFileSync(pdfOutputPath, pdfBuf);
    console.log("✅ UK Report PDF generated:", pdfOutputPath);
    return `/reports/${pdfFilename}`;
  } catch (err) {
    console.error("❌ Failed to convert DOCX to PDF. Returning DOCX instead:", err);
    return `/reports/${docxFilename}`;
  }
}

// ─── Full generation with real emission data (used by main pipeline) ─────────
export async function generateReport(commonData: any) {
  const resultPath = await generateUKReport(commonData);
  return { reportUrl: resultPath };
}
