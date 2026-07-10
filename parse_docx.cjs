const mammoth = require("mammoth");

async function parseDocx(filepath) {
  try {
    const result = await mammoth.convertToHtml({ path: filepath });
    const html = result.value;
    console.log("Extracted HTML from", filepath);
    console.log("--------------------------------------------------");
    console.log(html.substring(0, 2000)); // Log the first 2000 chars
    console.log("--------------------------------------------------");
  } catch (error) {
    console.error("Error parsing", filepath, error);
  }
}

parseDocx("C:\\Users\\Sarwang\\Downloads\\CarbonSynq_Earth_UK_Energy_Carbon_50_Page_Report.docx");
