const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");

const reports = [
  { region: "uk", file: "C:\\Users\\Sarwang\\Downloads\\CarbonSynq_Earth_UK_Energy_Carbon_50_Page_Report.docx" },
  { region: "australia", file: "C:\\Users\\Sarwang\\Downloads\\CarbonSynq_Earth_Australia_Official_Format_Report.docx" },
  { region: "france", file: "C:\\Users\\Sarwang\\Downloads\\CarbonSynq_Earth_France_Official_Format_Report (1).docx" },
  { region: "germany", file: "C:\\Users\\Sarwang\\Downloads\\CarbonSynq_Earth_Germany_Official_Format_Report.docx" },
  { region: "usa", file: "C:\\Users\\Sarwang\\Downloads\\CarbonSynq_Earth_United_States_Official_Format_Report.docx" },
  { region: "malaysia", file: "C:\\Users\\Sarwang\\Downloads\\CarbonSynq_Earth_Malaysia_Official_Format_Report.docx" }
];

async function convertAll() {
  for (const report of reports) {
    if (fs.existsSync(report.file)) {
      try {
        const result = await mammoth.convertToHtml({ path: report.file });
        const htmlPath = path.join(process.cwd(), `src/services/reports/${report.region}/raw_template.html`);
        fs.writeFileSync(htmlPath, result.value);
        console.log(`Converted ${report.region} to ${htmlPath}`);
      } catch (err) {
        console.error(`Error converting ${report.region}:`, err);
      }
    } else {
      console.error(`File not found: ${report.file}`);
    }
  }
}

convertAll();
