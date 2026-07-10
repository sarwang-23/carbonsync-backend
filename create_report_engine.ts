import fs from "fs";
import path from "path";

const REPORTS_DIR = path.join(process.cwd(), "src/services/reports");

const countries = [
  { name: "india", title: "BRSR Core", region: "IN" },
  { name: "uk", title: "SECR", region: "UK" },
  { name: "australia", title: "NGER", region: "AU" },
  { name: "germany", title: "CSRD", region: "DE" },
  { name: "france", title: "Base Carbone", region: "FR" },
  { name: "malaysia", title: "Bursa Sustainability", region: "MY" },
  { name: "usa", title: "EPA Sustainability", region: "US" }
];

function generateTemplate(title: string) {
  return `export function generateReport(commonData: any) {
  const {
    file, extractedItems, calculationResults, totalKgCO2e, totalTCO2e,
    successful, failed, dataQuality, documentLabel,
    scope1, scope2, scope3, scope3ReportLabel, scope3Description, scopeCategorySummary,
    currentDate, rows, itemRows
  } = commonData;

  function formatNumber(value: any, digits = 2) {
    return Number(value || 0).toFixed(digits);
  }

  function truncateNumber(value: any, digits = 5) {
    const num = Number(value || 0);
    const factor = Math.pow(10, digits);
    return (Math.trunc(num * factor) / factor).toFixed(digits);
  }

  return \`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1f2937; background: #f8fafc; }
    .page { width: 794px; min-height: 1123px; padding: 52px; page-break-after: always; position: relative; background: #ffffff; overflow: hidden; }
    .green-top { background: linear-gradient(135deg, #146c43 0%, #18864b 55%, #22a163 100%); height: 150px; margin: -52px -52px 82px -52px; padding: 42px 52px; color: white; font-size: 42px; font-weight: 800; letter-spacing: -0.5px; }
    .title { font-size: 36px; line-height: 1.2; color: #172033; font-weight: 700; margin-bottom: 34px; }
    .green-line { width: 245px; height: 8px; background: #18864b; border-radius: 10px; margin: 14px 0 34px 0; }
    .report-pill { display: inline-block; background: #ecfdf5; color: #166534; border: 1px solid #bbf7d0; border-radius: 999px; padding: 8px 14px; font-size: 12px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; margin-bottom: 18px; }
    .cover-meta { border: 1px solid #d1fae5; background: #f8fffb; border-radius: 14px; padding: 18px 20px; margin-top: 18px; }
    .label { color: #6b7280; font-size: 18px; margin-top: 26px; }
    .value { color: #172033; font-size: 20px; font-weight: 700; margin-top: 6px; }
    .toc { margin-top: 70px; }
    .toc h3 { color: #18864b; font-size: 18px; }
    .toc-row { display: flex; justify-content: space-between; font-size: 13px; margin: 10px 0; }
    .footer { position: absolute; bottom: 35px; left: 52px; right: 52px; color: #6b7280; font-size: 11px; display: flex; justify-content: space-between; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    .report-header { background: linear-gradient(90deg, #146c43, #18864b); color: white; margin: -52px -52px 42px -52px; padding: 18px 52px; font-weight: 800; letter-spacing: 0.2px; display: flex; justify-content: space-between; }
    .muted-badge { background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.35); border-radius: 999px; padding: 4px 10px; font-size: 10px; }
    h1 { font-size: 25px; color: #18864b; margin: 0 0 8px 0; }
    h2 { font-size: 21px; color: #18864b; margin: 28px 0 16px 0; }
    .underline { width: 100%; height: 3px; background: #18864b; margin-bottom: 28px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 30px 0; }
    .summary-card { border: 1px solid #d1fae5; background: linear-gradient(180deg, #ffffff 0%, #f8fffb 100%); border-radius: 14px; padding: 16px; min-height: 105px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05); }
    .summary-card .big { color: #172033; font-size: 24px; font-weight: 700; margin-bottom: 6px; }
    .summary-card .small { color: #18864b; font-weight: 700; font-size: 13px; text-transform: uppercase; margin-bottom: 5px; }
    .summary-card .desc { color: #6b7280; font-size: 12px; }
    .tiny-note { color: #6b7280; font-size: 9px; line-height: 1.25; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 18px; font-size: 7.5px; table-layout: fixed; word-break: break-word; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
    th { background: #1f2937; color: #fff; text-align: left; padding: 5px; font-size: 7.5px; word-break: break-word; }
    td { border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 6px; vertical-align: top; word-break: break-word; }
    tr:nth-child(even) td { background: #f9fafb; }
    .green-th th { background: #18864b; }
    .note { color: #166534; background: #ecfdf5; border-left: 4px solid #18864b; border-radius: 10px; font-style: italic; font-size: 12px; margin-top: 20px; line-height: 1.5; padding: 12px 14px; }
    .quality-box { border: 1px solid #d1fae5; background: #f8fffb; border-radius: 12px; padding: 14px; font-size: 12px; line-height: 1.6; margin-top: 18px; }
    .recommendation { font-size: 13px; line-height: 1.6; margin-bottom: 10px; }
  </style>
</head>

<body>
  <div class="page">
    <div class="green-top">CarbonSynq</div>
    <div class="report-pill">${title} | Draft Compliance Output</div>
    <div class="title">${title} emissions<br />Compliance Report</div>
    <div class="green-line"></div>
    <div class="label">Prepared for:</div>
    <div class="value">CarbonSynq Demo Client</div>
    <div class="label">Reporting Period:</div>
    <div class="value">Invoice Upload Based Report</div>
    <div class="cover-meta">
      <div class="label">Generated on:</div>
      <div class="value">\${currentDate}</div>
      <div class="label">Source Document:</div>
      <div class="value">\${documentLabel}</div>
      <div class="label">Data Quality:</div>
      <div class="value">\${dataQuality}</div>
    </div>
    <div class="toc">
      <h3>Table of Contents</h3>
      <div class="toc-row"><span>1. Executive Summary & Emissions</span><span>Page 2</span></div>
      <div class="toc-row"><span>2. ${title} Metrics</span><span>Page 3</span></div>
      <div class="toc-row"><span>3. Audit Trail and Methodology</span><span>Page 4</span></div>
      <div class="toc-row"><span>4. Invoice-wise Emissions Breakdown</span><span>Page 5</span></div>
      <div class="toc-row"><span>5. Item-wise Calculation Details</span><span>Page 6</span></div>
      <div class="toc-row"><span>6. Decarbonization Recommendations</span><span>Page 7</span></div>
    </div>
    <div class="footer">
      <span>Strictly Confidential. Powered by CarbonSynq AI Data Engine.</span>
    </div>
  </div>

  <div class="page">
    <div class="report-header"><span>CarbonSynq Enterprise | CarbonSynq Demo Client</span><span class="muted-badge">Draft Report</span></div>
    <h1>Executive Summary and Emissions</h1>
    <div class="underline"></div>
    <p>
      <b>Executive view:</b> CarbonSynq processed the uploaded source document and generated an invoice-linked emissions inventory.
      This report outlines the greenhouse gas inventory generated from uploaded invoice data.
    </p>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="small">Scope 1</div>
        <div class="big">\${formatNumber(scope1, 1)}</div>
        <div class="desc">Direct Emissions tCO2e</div>
      </div>
      <div class="summary-card">
        <div class="small">Scope 2</div>
        <div class="big">\${formatNumber(scope2, 4)}</div>
        <div class="desc">Indirect Energy tCO2e</div>
      </div>
      <div class="summary-card">
        <div class="small">Scope 3</div>
        <div class="big">\${truncateNumber(scope3, 5)}</div>
        <div class="desc">\${scope3Description}</div>
      </div>
      <div class="summary-card">
        <div class="small">Total Footprint</div>
        <div class="big">\${truncateNumber(totalTCO2e, 5)}</div>
        <div class="desc">Calculated Emissions</div>
      </div>
    </div>
    <h2>Energy Intensity Metrics</h2>
    <table>
      <tr><th>Metric</th><th>Value</th><th>Calculation Base</th></tr>
      <tr><td>Emissions per Invoice</td><td>\${truncateNumber(totalTCO2e, 5)} tCO2e</td><td>Uploaded invoice: \${file?.originalname || "N/A"}</td></tr>
      <tr><td>Total Extracted Items</td><td>\${extractedItems.length}</td><td>OCR / PDF text extraction</td></tr>
    </table>
    <div class="footer"><span>Reporting Period: Invoice Based</span><span>Page 2</span></div>
  </div>

  <div class="page">
    <div class="report-header"><span>CarbonSynq Enterprise | CarbonSynq Demo Client</span><span class="muted-badge">Draft Report</span></div>
    <h1>${title} Core Metrics</h1>
    <div class="underline"></div>
    <table>
      <tr><th>Leadership Indicator</th><th>Unit</th><th>Current Financial Year</th></tr>
      <tr><td>Total electricity consumption (A)</td><td>kWh</td><td>\${extractedItems.find((x: any) => String(x.item_name).toLowerCase().includes("electricity"))?.quantity || "Data dependent"}</td></tr>
      <tr><td>Scope 1 GHG Emissions</td><td>Metric tonnes of CO2e</td><td>\${formatNumber(scope1, 2)}</td></tr>
      <tr><td>Scope 2 GHG Emissions</td><td>Metric tonnes of CO2e</td><td>\${formatNumber(scope2, 4)}</td></tr>
      <tr><td>\${scope3ReportLabel}</td><td>Metric tonnes of CO2e</td><td>\${truncateNumber(scope3, 5)}</td></tr>
      <tr><td>Applicable GHG Scope Category</td><td>GHG Protocol category</td><td>\${scopeCategorySummary}</td></tr>
      <tr><td>Total GHG Emissions</td><td>Metric tonnes of CO2e</td><td>\${truncateNumber(totalTCO2e, 5)}</td></tr>
    </table>
    <div class="footer"><span>Reporting Period: Invoice Based</span><span>Page 3</span></div>
  </div>

  <div class="page">
    <div class="report-header"><span>CarbonSynq Enterprise | CarbonSynq Demo Client</span><span class="muted-badge">Draft Report</span></div>
    <h1>Audit Trail and Methodology</h1>
    <div class="underline"></div>
    <div class="quality-box">
      <b>Current Data Quality Rating:</b> \${dataQuality}<br />
      <b>Successful Calculations:</b> \${successful.length} of \${extractedItems.length}<br />
      <b>Uploaded Source:</b> \${file?.originalname || "N/A"}
    </div>
    <div class="footer"><span>Reporting Period: Invoice Based</span><span>Page 4</span></div>
  </div>

  <div class="page">
    <div class="report-header"><span>CarbonSynq Enterprise | CarbonSynq Demo Client</span><span class="muted-badge">Draft Report</span></div>
    <h1>Invoice-wise Emissions Breakdown</h1>
    <div class="underline"></div>
    <table>
      <tr><th>Item Name</th><th>Scope / Category</th><th>Activity Data</th><th>EF Value</th><th>EF Unit</th><th>kgCO2e</th><th>tCO2e</th><th>Activity ID</th><th>Factor Name</th><th>Region</th><th>Year</th><th>Category</th><th>Dataset</th><th>LCA Activity</th><th>Source</th></tr>
      \${rows || \`<tr><td colspan="15">No successful calculation rows available.</td></tr>\`}
    </table>
    <div class="note">Data uncertainty assessed based on system extraction and emission factor matching. Manual verification is recommended.</div>
    <div class="footer"><span>Reporting Period: Invoice Based</span><span>Page 5</span></div>
  </div>

  <div class="page">
    <div class="report-header"><span>CarbonSynq Enterprise | CarbonSynq Demo Client</span><span class="muted-badge">Draft Report</span></div>
    <h1>Item-wise Extraction Details</h1>
    <div class="underline"></div>
    <table>
      <tr><th>Extracted Item</th><th>Scope</th><th>GHG Category</th><th>Quantity</th><th>Unit</th><th>Confidence</th></tr>
      \${itemRows || \`<tr><td colspan="6">No extracted items available.</td></tr>\`}
    </table>
    <h2>Calculation Status</h2>
    <table class="green-th">
      <tr><th>Status</th><th>Count</th></tr>
      <tr><td>Successful Calculations</td><td>\${successful.length}</td></tr>
      <tr><td>Failed Calculations</td><td>\${failed.length}</td></tr>
      <tr><td>Total Calculated Footprint</td><td>\${truncateNumber(totalTCO2e, 5)} tCO2e</td></tr>
    </table>
    <div class="footer"><span>Reporting Period: Invoice Based</span><span>Page 6</span></div>
  </div>

  <div class="page">
    <div class="report-header"><span>CarbonSynq Enterprise | CarbonSynq Demo Client</span><span class="muted-badge">Draft Report</span></div>
    <h1>Decarbonization Recommendations</h1>
    <div class="underline"></div>
    <div class="recommendation">1. Optimize electricity consumption...</div>
    <div class="footer"><span>Generated by CarbonSynq Platform</span><span>Page 7</span></div>
  </div>
</body>
</html>\`;
}
`;
}

function main() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  let routerImports = "";
  let routerSwitch = "";

  countries.forEach(country => {
    const dir = path.join(REPORTS_DIR, country.name);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(path.join(dir, "generator.ts"), generateTemplate(country.title));

    routerImports += \`import { generateReport as generate\${country.region}Report } from "./\${country.name}/generator.js";\n\`;
    
    // We handle UK separately to map GB to UK
    if (country.region === "UK") {
      routerSwitch += \`    case "GB":\n    case "UK":\n      return generateUKReport(commonData);\n\`;
    } else {
      routerSwitch += \`    case "\${country.region}":\n      return generate\${country.region}Report(commonData);\n\`;
    }
  });

  const routerCode = \`\${routerImports}

export function generateLocalReportHtml(region: string, commonData: any): string {
  const normalizedRegion = (region || "IN").toUpperCase();

  switch (normalizedRegion) {
\${routerSwitch}
    default:
      return generateINReport(commonData);
  }
}
\`;

  fs.writeFileSync(path.join(REPORTS_DIR, "router.ts"), routerCode);
}

main();
