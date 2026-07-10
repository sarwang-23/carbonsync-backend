const fs = require("fs");
const path = require("path");

const servicePath = path.join(process.cwd(), "src/services/Report.service.ts");
let content = fs.readFileSync(servicePath, "utf-8");

content = content.replace(
  'import { generateLocalReportHtml } from "./reports/router.js";',
  'import { generateLocalReport } from "./reports/router.js";'
);

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
    
    if (localReportResult?.reportUrl || localReportResult?.docxPath) {
      const finalPath = localReportResult.reportUrl || localReportResult.docxPath;
      console.log("[Timing] Local report generation complete:", finalPath);
      brsrReport = { reportUrl: finalPath };
    } else if (localReportResult?.html) {
      const startBrsr = Date.now();
      try {
        brsrReport = await generatePdfFromHtml(localReportResult.html, "CS-BRSR", browser);
        console.log(\`[Timing] BRSR HTML report generation time: \${Date.now() - startBrsr}ms\`);
      } catch (err) {
        console.error("BRSR report generation failed:", err);
      }
    }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(servicePath, content);
console.log("Updated Report.service.ts");
