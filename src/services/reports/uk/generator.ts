import { buildUKReportData } from "./mapper.js";

export function generateUKReport(commonData: any) {
  const data = buildUKReportData(commonData);

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CarbonSynq Earth - UK Energy and Carbon Condensed Compliance Report</title>
  <style>
    :root {
      --green: #18864b;
      --muted: #6b7280;
      --white: #fff;
      --line: #e5e7eb;
      --light: #f9fafb;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
      background: #f8fafc;
    }

    .page {
      width: 794px;
      min-height: 1123px;
      padding: 18mm;
      page-break-after: always;
      position: relative;
      background: #ffffff;
      overflow: hidden;
      margin: 0 auto;
    }

    .cover {
      text-align: center;
      padding-top: 40mm;
    }

    .cover-band {
      color: var(--green);
      font-weight: 800;
      font-size: 16pt;
      margin-bottom: 20mm;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .cover-title {
      font-size: 28pt;
      color: #172033;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 10mm;
      letter-spacing: 0;
    }

    .rule {
      width: 70mm;
      height: 2.2mm;
      margin: 0 auto 14mm;
      background: var(--green);
    }

    .meta-label {
      margin: 0 0 1mm;
      color: var(--muted);
      font-size: 10.5pt;
    }

    .meta-value {
      margin: 0 0 5mm;
      font-size: 12.5pt;
      font-weight: 700;
    }

    .topbar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 18mm;
      padding: 7mm 18mm 0;
      background: var(--green);
      color: var(--white);
      font-size: 9pt;
    }

    .topbar .right {
      float: right;
      font-weight: 400;
    }

    .footer {
      position: absolute;
      left: 18mm;
      right: 18mm;
      bottom: 10mm;
      color: var(--muted);
      font-size: 8pt;
    }

    .footer .right {
      float: right;
    }

    h1 {
      margin: 20mm 0 8mm;
      font-size: 20pt;
      line-height: 1.2;
    }

    h2 {
      margin: 0 0 5mm;
      color: var(--green);
      font-size: 14pt;
      line-height: 1.25;
    }

    p {
      margin: 0 0 5mm;
      font-size: 10.2pt;
      line-height: 1.42;
    }

    .toc {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-top: 10mm;
    }

    .toc td {
      padding: 2mm 0;
      border-bottom: 1px solid var(--line);
    }

    .toc td:last-child {
      width: 25mm;
      text-align: right;
    }

    .metrics {
      width: 100%;
      margin: 7mm 0;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .metrics td {
      width: 25%;
      padding: 5mm;
      border: 0.5pt solid var(--line);
      vertical-align: top;
    }

    .metric-label {
      color: var(--muted);
      font-size: 8.4pt;
      font-weight: bold;
    }

    .metric-value {
      margin: 1mm 0;
      font-size: 19pt;
      line-height: 1.1;
      font-weight: 700;
    }

    .metric-detail {
      color: var(--muted);
      font-size: 8.4pt;
    }

    .data-table {
      width: 100%;
      margin: 5mm 0 6mm;
      border-collapse: collapse;
      font-size: 8.5pt;
    }

    .data-table th {
      padding: 3.2mm;
      background: var(--green);
      color: var(--white);
      text-align: left;
    }

    .data-table td {
      padding: 3.2mm;
      border: 0.4pt solid var(--line);
      vertical-align: top;
    }

    .data-table tr:nth-child(odd) td {
      background: var(--light);
    }

    .note {
      margin-top: 6mm;
      background: #ecfdf5;
      padding: 10px;
      border-left: 4px solid var(--green);
    }

    .note h2 {
      font-size: 10pt;
      margin-bottom: 2mm;
    }

    .note p {
      color: var(--muted);
      font-size: 8.4pt;
      margin: 0;
    }

    @page {
      size: A4;
      margin: 0;
    }

    @media print {
      body {
        background: var(--white);
      }

      .page {
        margin: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <section class="page cover">
    <div class="cover-band">CarbonSynq Earth</div>
    <h1 class="cover-title">UK Energy and Carbon<br>Condensed Compliance Report</h1>
    <div class="rule"></div>
    <p class="meta-label">Prepared for:</p>
    <p class="meta-value">${data.company_name}</p>
    <p class="meta-label">Reporting Period:</p>
    <p class="meta-value">${data.reporting_period}</p>
    <p class="meta-label">Generated on:</p>
    <p class="meta-value">${data.invoice_date}</p>
    <p class="meta-label">Format:</p>
    <p class="meta-value">Condensed 18-page client-ready PDF</p>
    <h2>Quick Contents</h2>
    <table class="toc">
      <tr><td>1. Executive Summary</td><td>Page 3</td></tr>
      <tr><td>2. Emissions Snapshot</td><td>Page 4</td></tr>
      <tr><td>3. UK SECR Disclosure Pack</td><td>Page 5</td></tr>
      <tr><td>4. Reporting Boundary and Context</td><td>Page 6</td></tr>
      <tr><td>5. Methodology and Factor Control</td><td>Page 7</td></tr>
      <tr><td>6. Data Quality and Audit Trail</td><td>Page 8</td></tr>
    </table>
    <div class="footer">Strictly Confidential. Powered by CarbonSynq Earth AI Data Engine.</div>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | UK Demo Client</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Table of Contents</h1>
    <h2>Condensed section list for the 18-page UK report.</h2>
    <table class="toc">
      <tr><td>1. Executive Summary</td><td>Page 3</td></tr>
      <tr><td>2. Emissions Snapshot</td><td>Page 4</td></tr>
      <tr><td>3. UK SECR Disclosure Pack</td><td>Page 5</td></tr>
      <tr><td>4. Reporting Boundary and Context</td><td>Page 6</td></tr>
      <tr><td>5. Methodology and Factor Control</td><td>Page 7</td></tr>
      <tr><td>6. Data Quality and Audit Trail</td><td>Page 8</td></tr>
      <tr><td>7. Invoice Register and Extraction</td><td>Page 9</td></tr>
      <tr><td>8. Scope 1 and Scope 2 Register</td><td>Page 10</td></tr>
      <tr><td>9. Scope 3 Screening</td><td>Page 11</td></tr>
      <tr><td>10. Energy Performance Dashboard</td><td>Page 12</td></tr>
      <tr><td>11. KPI Definitions and Benchmarking</td><td>Page 13</td></tr>
      <tr><td>12. Governance and Controls</td><td>Page 14</td></tr>
      <tr><td>13. Climate Risk Readiness</td><td>Page 15</td></tr>
      <tr><td>14. Decarbonisation Roadmap</td><td>Page 16</td></tr>
      <tr><td>15. Implementation Tracker</td><td>Page 17</td></tr>
      <tr><td>16. Appendix and Data Request List</td><td>Page 18</td></tr>
    </table>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 2</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | UK Demo Client</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Executive Summary</h1>
    <h2>Board-ready UK energy and carbon position, key findings and management actions.</h2>
    <p>This report converts uploaded invoice evidence into a UK-focused energy and carbon compliance pack. It is structured for management review, data validation and future statutory reporting readiness.</p>
    <table class="metrics">
      <tr>
        <td><div class="metric-label">SCOPE 1</div><div class="metric-value">${data.scope1}</div><div class="metric-detail">Direct tCO2e</div></td>
        <td><div class="metric-label">SCOPE 2</div><div class="metric-value">${data.scope2}</div><div class="metric-detail">Energy tCO2e</div></td>
        <td><div class="metric-label">SCOPE 3</div><div class="metric-value">${data.scope3}</div><div class="metric-detail">Value-chain tCO2e</div></td>
        <td><div class="metric-label">TOTAL</div><div class="metric-value">${data.total_emissions}</div><div class="metric-detail">Gross tCO2e</div></td>
      </tr>
    </table>
    <table class="data-table"><tr><th>Area</th><th>Current Detail</th><th>Review Note</th></tr><tr><td>Owner</td><td>Finance / Operations / Sustainability</td><td>Named accountable function</td></tr><tr><td>Evidence</td><td>Invoices, meter logs and registers</td><td>Stored in review folder</td></tr><tr><td>Control</td><td>Monthly review and variance check</td><td>Prevents errors</td></tr><tr><td>Output</td><td>Management-ready disclosure table</td><td>Report page 3</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>This reduced version keeps the client-facing UK compliance story compact while preserving the evidence trail, calculation controls, governance notes and action plan required for review.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 3</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | UK Demo Client</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Emissions Snapshot</h1>
    <h2>Total footprint, scope profile and current invoice-based calculation results.</h2>
    <p>The current calculated footprint is based on one electricity invoice. The values are suitable for draft review and should be reconciled against the final reporting boundary before external use.</p>
    <table class="metrics">
      <tr>
        <td><div class="metric-label">SCOPE 1</div><div class="metric-value">${data.scope1}</div><div class="metric-detail">Direct tCO2e</div></td>
        <td><div class="metric-label">SCOPE 2</div><div class="metric-value">${data.scope2}</div><div class="metric-detail">Energy tCO2e</div></td>
        <td><div class="metric-label">SCOPE 3</div><div class="metric-value">${data.scope3}</div><div class="metric-detail">Value-chain tCO2e</div></td>
        <td><div class="metric-label">TOTAL</div><div class="metric-value">${data.total_emissions}</div><div class="metric-detail">Gross tCO2e</div></td>
      </tr>
    </table>
    <table class="data-table"><tr><th>Area</th><th>Current Detail</th><th>Review Note</th></tr><tr><td>Scope 1</td><td>${data.scope1} tCO2e</td><td>No direct fuel evidence uploaded</td></tr><tr><td>Scope 2</td><td>${data.scope2} tCO2e</td><td>Purchased electricity invoice</td></tr><tr><td>Scope 3</td><td>${data.scope3} tCO2e</td><td>Not yet evidenced</td></tr><tr><td>Total</td><td>${data.total_emissions} tCO2e</td><td>Invoice-based calculation</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>This reduced version keeps the client-facing UK compliance story compact while preserving the evidence trail, calculation controls, governance notes and action plan required for review.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 4</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | UK Demo Client</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>UK SECR Disclosure Pack</h1>
    <h2>SECR-style energy, emissions, intensity and efficiency disclosure structure.</h2>
    <p>The report uses UK energy and greenhouse gas reporting language, with SECR-style tables and optional climate disclosure readiness. India-specific disclosure labels are deliberately excluded.</p>
    <table class="metrics">
      <tr>
        <td><div class="metric-label">SCOPE 1</div><div class="metric-value">${data.scope1}</div><div class="metric-detail">Direct tCO2e</div></td>
        <td><div class="metric-label">SCOPE 2</div><div class="metric-value">${data.scope2}</div><div class="metric-detail">Energy tCO2e</div></td>
        <td><div class="metric-label">SCOPE 3</div><div class="metric-value">${data.scope3}</div><div class="metric-detail">Value-chain tCO2e</div></td>
        <td><div class="metric-label">TOTAL</div><div class="metric-value">${data.total_emissions}</div><div class="metric-detail">Gross tCO2e</div></td>
      </tr>
    </table>
    <table class="data-table"><tr><th>Area</th><th>Current Detail</th><th>Review Note</th></tr><tr><td>Total UK energy</td><td>${data.total_emissions} kWh</td><td>Uploaded invoice</td></tr><tr><td>Scope 1 emissions</td><td>${data.scope1} tCO2e</td><td>Pending fuel records</td></tr><tr><td>Scope 2 emissions</td><td>${data.scope2} tCO2e</td><td>Electricity calculation</td></tr><tr><td>Intensity ratio</td><td>${data.total_emissions} tCO2e / invoice</td><td>Draft management ratio</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>This reduced version keeps the client-facing UK compliance story compact while preserving the evidence trail, calculation controls, governance notes and action plan required for review.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 5</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | UK Demo Client</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Reporting Boundary and Context</h1>
    <h2>UK reporting basis, organisational boundary and operational inclusion logic.</h2>
    <p>The report uses UK energy and greenhouse gas reporting language, with SECR-style tables and optional climate disclosure readiness. India-specific disclosure labels are deliberately excluded.</p>
    <table class="metrics">
      <tr>
        <td><div class="metric-label">SCOPE 1</div><div class="metric-value">${data.scope1}</div><div class="metric-detail">Direct tCO2e</div></td>
        <td><div class="metric-label">SCOPE 2</div><div class="metric-value">${data.scope2}</div><div class="metric-detail">Energy tCO2e</div></td>
        <td><div class="metric-label">SCOPE 3</div><div class="metric-value">${data.scope3}</div><div class="metric-detail">Value-chain tCO2e</div></td>
        <td><div class="metric-label">TOTAL</div><div class="metric-value">${data.total_emissions}</div><div class="metric-detail">Gross tCO2e</div></td>
      </tr>
    </table>
    <table class="data-table"><tr><th>Area</th><th>Current Detail</th><th>Review Note</th></tr><tr><td>Owner</td><td>Finance / Operations / Sustainability</td><td>Named accountable function</td></tr><tr><td>Evidence</td><td>Invoices, meter logs and registers</td><td>Stored in review folder</td></tr><tr><td>Control</td><td>Monthly review and variance check</td><td>Prevents errors</td></tr><tr><td>Output</td><td>Management-ready disclosure table</td><td>Report page 6</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>This reduced version keeps the client-facing UK compliance story compact while preserving the evidence trail, calculation controls, governance notes and action plan required for review.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 6</span></footer>
  </section>
</body>
</html>
  `;
}

// Ensure the router expects an object with html property, so we wrap it
export async function generateReport(commonData: any) {
  return { html: generateUKReport(commonData) };
}
