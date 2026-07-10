const fs = require("fs");
const path = require("path");

const servicePath = path.join(process.cwd(), "src/services/Report.service.ts");
let content = fs.readFileSync(servicePath, "utf-8");

// Fix import
content = content.replace(
  'import { generateLocalReportHtml } from "./reports/router.js";',
  'import { generateLocalReport } from "./reports/router.js";'
);

// We need to replace the old execution logic:
const oldLogic = `    const commonData = buildCommonData(safePayload);
    const region = safePayload.region || safePayload.calculationResults?.[0]?.region || "IN";
    const brsrHtml = generateLocalReportHtml(region, commonData);
    const cbamHtml = buildCBAMHtml(safePayload);

    // IMPORTANT SPEED FIX:
    // Earlier code launched Puppeteer twice: once for BRSR and once for CBAM.
    // That is very slow on Render. Now both PDFs share one browser instance.
    // Execute sequentially to avoid Puppeteer Target closed errors
    const startBrsr = Date.now();
    let brsrReport = { reportUrl: "" };
    try {
      brsrReport = await generatePdfFromHtml(brsrHtml, "CS-BRSR", browser);
      console.log(\`[Timing] BRSR report generation time: \${Date.now() - startBrsr}ms\`);
    } catch (err) {
      console.error("BRSR report generation failed:", err);
    }`;

const newLogic = `    const commonData = buildCommonData(safePayload);
    const region = safePayload.region || safePayload.calculationResults?.[0]?.region || "IN";
    
    // NEW ARCHITECTURE: DocxTemplater
    const localReportResult = await generateLocalReport(region, commonData);
    const cbamHtml = buildCBAMHtml(safePayload);

    // IMPORTANT SPEED FIX:
    // Execute sequentially to avoid Puppeteer Target closed errors
    let brsrReport = { reportUrl: "" };
    
    if (localReportResult?.docxPath) {
      // DOCX Generation successful
      console.log("[Timing] Local report DOCX generation complete:", localReportResult.docxPath);
      // For now, returning the raw file path. Ideally, it should be a public URL.
      brsrReport = { reportUrl: localReportResult.docxPath };
    } else if (localReportResult?.html) {
      // Fallback to HTML/PDF Puppeteer execution (e.g. India BRSR)
      const startBrsr = Date.now();
      try {
        brsrReport = await generatePdfFromHtml(localReportResult.html, "CS-BRSR", browser);
        console.log(\`[Timing] BRSR HTML report generation time: \${Date.now() - startBrsr}ms\`);
      } catch (err) {
        console.error("BRSR report generation failed:", err);
      }
    }`;

if (content.includes("const brsrHtml = generateLocalReportHtml(region, commonData);")) {
  content = content.replace(oldLogic, newLogic);
  fs.writeFileSync(servicePath, content);
  console.log("Updated Report.service.ts for docxtemplater integration.");
} else {
  console.error("Could not find the target code to replace in Report.service.ts");
}
