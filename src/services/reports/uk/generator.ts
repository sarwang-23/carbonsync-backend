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
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
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
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
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
    <table class="data-table"><tr><th>Emission Category</th><th>Calculated Value</th><th>Review Note</th></tr><tr><td>Scope 1 (Direct Combustion)</td><td>${data.scope1} tCO2e</td><td>${Number(data.scope1) > 0 ? 'Gas / diesel invoices processed' : 'No direct fuel evidence uploaded'}</td></tr><tr><td>Scope 2 (Purchased Electricity)</td><td>${data.scope2} tCO2e</td><td>${Number(data.scope2) > 0 ? 'Electricity invoice processed' : 'No electricity invoice uploaded'}</td></tr><tr><td>Scope 3 (Value Chain)</td><td>${data.scope3} tCO2e</td><td>${Number(data.scope3) > 0 ? 'Third-party activity data included' : 'Not yet evidenced'}</td></tr><tr><td>Total Gross Emissions</td><td>${data.total_emissions} tCO2e</td><td>Invoice-based AI calculation</td></tr><tr><td>Items Processed</td><td>${data.items_processed} of ${data.items_total} items</td><td>Data quality: ${data.data_quality} (${data.data_quality_pct}%)</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>Report generated on ${data.invoice_date}. Based on ${data.items_processed} invoice items. Electricity: ${data.electricity} tCO2e | Natural Gas: ${data.natural_gas} tCO2e | Diesel: ${data.diesel} tCO2e.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 3</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
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
    <table class="data-table"><tr><th>Scope</th><th>Calculated tCO2e</th><th>kgCO2e</th><th>Review Note</th></tr><tr><td>Scope 1 (Direct Combustion)</td><td>${data.scope1} tCO2e</td><td>${(Number(data.scope1)*1000).toFixed(3)} kgCO2e</td><td>${Number(data.scope1) > 0 ? 'Gas / diesel combustion included' : 'No direct fuel evidence'}</td></tr><tr><td>Scope 2 (Purchased Electricity)</td><td>${data.scope2} tCO2e</td><td>${(Number(data.scope2)*1000).toFixed(3)} kgCO2e</td><td>${Number(data.scope2) > 0 ? 'Electricity invoice processed ✓' : 'No electricity invoice'}</td></tr><tr><td>Scope 3 (Value Chain)</td><td>${data.scope3} tCO2e</td><td>${(Number(data.scope3)*1000).toFixed(3)} kgCO2e</td><td>${Number(data.scope3) > 0 ? 'Value chain activity' : 'Not yet evidenced'}</td></tr><tr><td><strong>TOTAL</strong></td><td><strong>${data.total_emissions} tCO2e</strong></td><td><strong>${data.total_kgco2e} kgCO2e</strong></td><td>Invoice-based AI calculation</td></tr></table>
    <div class="note"><h2>All Invoice Line Items</h2><p>Full item-level detail is available on Page 9 (Invoice Register). Scope 1: ${data.natural_gas} tCO2e gas + ${data.diesel} tCO2e diesel. Scope 2: ${data.electricity} tCO2e electricity.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 4</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
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
    <table class="data-table"><tr><th>SECR Category</th><th>Consumption / Emissions</th><th>Methodology Note</th></tr><tr><td>Total UK Energy Use</td><td>${data.total_energy_kwh} kWh</td><td>Aggregated from invoices</td></tr><tr><td>Scope 1 (Direct)</td><td>${data.scope1} tCO2e</td><td>${Number(data.scope1) > 0 ? 'Calculated from direct fuel' : 'No direct emissions reported'}</td></tr><tr><td>Scope 2 (Indirect)</td><td>${data.scope2} tCO2e</td><td>${Number(data.scope2) > 0 ? 'Location-based grid average' : 'No purchased electricity'}</td></tr><tr><td>Scope 3 (Value Chain)</td><td>${data.scope3} tCO2e</td><td>${Number(data.scope3) > 0 ? 'Included voluntary Scope 3' : 'Pending value chain data'}</td></tr><tr><td>Total Gross Emissions</td><td>${data.total_emissions} tCO2e</td><td>Required SECR disclosure</td></tr></table>
    <div class="note"><h2>SECR Compliance Note</h2><p>This section fulfills the Streamlined Energy and Carbon Reporting (SECR) requirements, presenting total energy use in kWh alongside Scope 1 and 2 emissions.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 5</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
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
    <table class="data-table"><tr><th>Boundary Parameter</th><th>Defined Value</th><th>Review Note</th></tr><tr><td>Reporting Framework</td><td>GHG Protocol / UK SECR</td><td>Aligned with UK Govt guidance</td></tr><tr><td>Consolidation Approach</td><td>Operational Control</td><td>Covers all uploaded evidence</td></tr><tr><td>Geographic Boundary</td><td>${data.country}</td><td>Based on document metadata</td></tr><tr><td>Inclusions</td><td>${data.items_processed} processed invoice items</td><td>${data.electricity} tCO2e (Elec) | ${data.natural_gas} tCO2e (Gas)</td></tr><tr><td>Exclusions</td><td>${data.items_failed} unmapped items</td><td>To be reviewed in next cycle</td></tr></table>
    <div class="note"><h2>Boundary Note</h2><p>Emissions are calculated for operations within the United Kingdom. Data quality rating for this boundary is ${data.data_quality} based on a ${data.data_quality_pct}% mapping success rate.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 6</span></footer>
  </section>
  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Methodology and Factor Control</h1>
    <h2>Calculation methodologies and emission factor sources used.</h2>
    <p>This section outlines the calculation principles applied to transform invoice data into carbon equivalents.</p>
    <table class="data-table"><tr><th>Category</th><th>Methodology</th><th>Source Factor</th></tr><tr><td>Electricity</td><td>Location-based grid average</td><td>DEFRA / UK Gov</td></tr><tr><td>Natural Gas</td><td>Gross calorific value basis</td><td>DEFRA / UK Gov</td></tr><tr><td>Diesel</td><td>Volume-based conversion</td><td>DEFRA / UK Gov</td></tr><tr><td>Scope 3</td><td>Spend-based or average-data</td><td>Climatiq / EEIO</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>This reduced version keeps the client-facing UK compliance story compact while preserving the evidence trail, calculation controls, governance notes and action plan required for review.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 7</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Data Quality and Audit Trail</h1>
    <h2>Confidence scoring and evidence traceability for uploaded invoices.</h2>
    <p>Data quality is automatically assessed based on extraction confidence and factor mapping precision.</p>
    <table class="data-table"><tr><th>Metric</th><th>Score</th><th>Impact</th></tr><tr><td>Items Successfully Processed</td><td>${data.items_processed} of ${data.items_total}</td><td>Reliable activity data</td></tr><tr><td>Factor Mapping Coverage</td><td>${data.data_quality_pct}% (${data.data_quality})</td><td>Low uncertainty in conversion</td></tr><tr><td>Items Failed / Unmapped</td><td>${data.items_failed}</td><td>Review manually</td></tr><tr><td>Audit Readiness</td><td>Strong — AI extracted</td><td>Invoices digitally preserved</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>This reduced version keeps the client-facing UK compliance story compact while preserving the evidence trail, calculation controls, governance notes and action plan required for review.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 8</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Invoice Register and Extraction</h1>
    <h2>Line-item level details of processed documentation.</h2>
    <p>A consolidated view of all uploaded evidence that forms the basis of this report. Generated on: ${data.invoice_date}</p>
    <table class="data-table"><tr><th>#</th><th>Item Name</th><th>Quantity</th><th>Activity ID</th><th>kgCO2e</th><th>tCO2e</th></tr>${data.invoice_register_html}</table>
    <div class="note"><h2>Condensed Review Note</h2><p>Total of ${data.items_processed} items processed successfully from uploaded invoices.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 9</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Scope 1 and Scope 2 Register</h1>
    <h2>Detailed breakdown of direct operations and purchased energy.</h2>
    <p>Scope 1 and 2 emissions are calculated using strict operational control boundaries.</p>
    <table class="metrics">
      <tr>
        <td><div class="metric-label">SCOPE 1</div><div class="metric-value">${data.scope1}</div><div class="metric-detail">Direct tCO2e</div></td>
        <td><div class="metric-label">SCOPE 2</div><div class="metric-value">${data.scope2}</div><div class="metric-detail">Energy tCO2e</div></td>
        <td><div class="metric-label">ELECTRICITY</div><div class="metric-value">${data.electricity}</div><div class="metric-detail">tCO2e</div></td>
        <td><div class="metric-label">NATURAL GAS</div><div class="metric-value">${data.natural_gas}</div><div class="metric-detail">tCO2e</div></td>
      </tr>
    </table>
    <p style="margin-top:5mm;"><strong>Scope 1 Line Items (Direct Emissions)</strong></p>
    <table class="data-table"><tr><th>Item</th><th>Quantity</th><th>EF</th><th>kgCO2e</th><th>tCO2e</th><th>Source</th><th>Year</th></tr>${data.scope1_rows_html}</table>
    <p style="margin-top:5mm;"><strong>Scope 2 Line Items (Purchased Energy)</strong></p>
    <table class="data-table"><tr><th>Item</th><th>Quantity</th><th>EF</th><th>kgCO2e</th><th>tCO2e</th><th>Source</th><th>Year</th></tr>${data.scope2_rows_html}</table>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 10</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Scope 3 Screening</h1>
    <h2>Value-chain emissions assessment and hotspots.</h2>
    <p>Scope 3 screening identifies the most significant indirect emission sources across the 15 GHG Protocol categories.</p>
    <table class="metrics">
      <tr>
        <td><div class="metric-label">SCOPE 3</div><div class="metric-value">${data.scope3}</div><div class="metric-detail">Total tCO2e</div></td>
        <td><div class="metric-label">ITEMS</div><div class="metric-value">${data.items_processed}</div><div class="metric-detail">Invoice items</div></td>
        <td><div class="metric-label">TOTAL</div><div class="metric-value">${data.total_emissions}</div><div class="metric-detail">Gross tCO2e</div></td>
        <td><div class="metric-label">STATUS</div><div class="metric-value">${data.data_quality}</div><div class="metric-detail">Data Quality</div></td>
      </tr>
    </table>
    <table class="data-table"><tr><th>Item</th><th>Quantity</th><th>EF</th><th>kgCO2e</th><th>tCO2e</th><th>Source</th><th>Year</th></tr>${data.scope3_rows_html}</table>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 11</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Energy Performance Dashboard</h1>
    <h2>Visualisation of energy consumption trends and efficiency.</h2>
    <p>Performance metrics are tracked to identify reduction opportunities and cost savings.</p>
    <table class="data-table"><tr><th>Metric</th><th>Current Period</th><th>Previous Period</th><th>Variance</th></tr><tr><td>Total tCO2e</td><td>${data.total_emissions} tCO2e</td><td>N/A</td><td>Baseline</td></tr><tr><td>Scope 1 (Direct)</td><td>${data.scope1} tCO2e</td><td>N/A</td><td>Baseline</td></tr><tr><td>Scope 2 (Electricity)</td><td>${data.scope2} tCO2e</td><td>N/A</td><td>Baseline</td></tr><tr><td>Scope 3 (Value-chain)</td><td>${data.scope3} tCO2e</td><td>N/A</td><td>Baseline</td></tr><tr><td>Energy Captured (kWh)</td><td>${data.total_energy_kwh} kWh</td><td>N/A</td><td>Baseline</td></tr><tr><td>Natural Gas (tCO2e)</td><td>${data.natural_gas}</td><td>N/A</td><td>Baseline</td></tr><tr><td>Diesel (tCO2e)</td><td>${data.diesel}</td><td>N/A</td><td>Baseline</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>Performance metrics based on ${data.items_processed} invoice items. Data quality: ${data.data_quality} (${data.data_quality_pct}% mapping success).</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 12</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>KPI Definitions and Benchmarking</h1>
    <h2>Key Performance Indicators used for operational tracking.</h2>
    <p>Standardised KPIs allow for internal benchmarking across sites and external industry comparisons.</p>
    <table class="data-table"><tr><th>KPI Name</th><th>Formula</th><th>Target Audience</th></tr><tr><td>Carbon Intensity</td><td>tCO2e / £1m Revenue</td><td>Investors, SECR</td></tr><tr><td>Energy Efficiency</td><td>kWh / m2 floor area</td><td>Facilities Management</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>This reduced version keeps the client-facing UK compliance story compact while preserving the evidence trail, calculation controls, governance notes and action plan required for review.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 13</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Governance and Controls</h1>
    <h2>Data management protocols and oversight structures.</h2>
    <p>Robust governance ensures reporting accuracy, consistency, and compliance with statutory requirements.</p>
    <table class="data-table"><tr><th>Control Area</th><th>Status</th><th>Owner</th></tr><tr><td>Data Collection</td><td>Automated</td><td>Operations</td></tr><tr><td>Validation</td><td>AI Verification</td><td>Finance</td></tr><tr><td>Final Sign-off</td><td>Pending</td><td>${data.ceo_name}</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>This reduced version keeps the client-facing UK compliance story compact while preserving the evidence trail, calculation controls, governance notes and action plan required for review.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 14</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Climate Risk Readiness</h1>
    <h2>Preparation for TCFD and related climate disclosure mandates.</h2>
    <p>An initial assessment of physical and transition risks associated with the operational footprint.</p>
    <table class="data-table"><tr><th>Risk Category</th><th>Exposure</th><th>Mitigation Strategy</th></tr><tr><td>Regulatory (Transition)</td><td>Medium</td><td>Proactive SECR reporting</td></tr><tr><td>Market (Transition)</td><td>Low</td><td>Supplier engagement</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>This reduced version keeps the client-facing UK compliance story compact while preserving the evidence trail, calculation controls, governance notes and action plan required for review.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 15</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Decarbonisation Roadmap</h1>
    <h2>Strategic pathways to achieve Net Zero targets.</h2>
    <p>Actionable recommendations based on the current footprint profile.</p>
    <table class="data-table"><tr><th>Initiative</th><th>Timeframe</th><th>Impact Potential</th></tr><tr><td>Renewable Energy Procurement</td><td>Short-term (1-2 yrs)</td><td>High</td></tr><tr><td>Energy Efficiency Upgrades</td><td>Medium-term (3-5 yrs)</td><td>Medium</td></tr><tr><td>${data.recommendation}</td><td>Ongoing</td><td>High</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>This reduced version keeps the client-facing UK compliance story compact while preserving the evidence trail, calculation controls, governance notes and action plan required for review.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 16</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Implementation Tracker</h1>
    <h2>Progress monitoring for identified reduction initiatives.</h2>
    <p>A living register to track the execution and success of decarbonisation projects.</p>
    <table class="data-table"><tr><th>Project</th><th>Status</th><th>Owner</th></tr><tr><td>Smart Meter Installation</td><td>Not Started</td><td>Facilities</td></tr><tr><td>Green Tariff Switch</td><td>In Review</td><td>Procurement</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>This reduced version keeps the client-facing UK compliance story compact while preserving the evidence trail, calculation controls, governance notes and action plan required for review.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 17</span></footer>
  </section>

  <section class="page">
    <header class="topbar"><strong>CarbonSynq Earth Enterprise | ${data.company_name}</strong><span class="right">UK Energy and Carbon Report</span></header>
    <h1>Appendix and Data Request List</h1>
    <h2>Supplementary information and next steps for comprehensive reporting.</h2>
    <p>To improve data quality and boundary completeness, the following additional evidence is requested.</p>
    <table class="data-table"><tr><th>Item Requested</th><th>Reason</th><th>Priority</th></tr><tr><td>Gas Invoices (12 months)</td><td>Complete Scope 1</td><td>High</td></tr><tr><td>Fleet Fuel Cards</td><td>Complete Scope 1</td><td>High</td></tr><tr><td>Waste Contracts</td><td>Scope 3 Screening</td><td>Medium</td></tr></table>
    <div class="note"><h2>Condensed Review Note</h2><p>This reduced version keeps the client-facing UK compliance story compact while preserving the evidence trail, calculation controls, governance notes and action plan required for review.</p></div>
    <footer class="footer">Reporting Period: ${data.reporting_period} <span class="right">Page 18</span></footer>
  </section>
</body>
</html>
  `;
}

// Ensure the router expects an object with html property, so we wrap it
export async function generateReport(commonData: any) {
  return { html: generateUKReport(commonData) };
}
