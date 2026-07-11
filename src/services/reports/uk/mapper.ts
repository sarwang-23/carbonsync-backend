export function buildUKReportData(commonData?: any) {
  const safeData = commonData || {};
  
  const results = safeData.calculationResults || [];
  const successful = results.filter((r: any) => r.success);
  const failed = results.filter((r: any) => !r.success);

  const formatNum = (val: any, digits = 4) => Number(val || 0).toFixed(digits);

  let scope1 = 0;
  let scope2 = 0;
  let scope3 = 0;
  let electricity = 0;
  let naturalGas = 0;
  let diesel = 0;
  let totalEnergyKwh = 0;

  const invoiceRows: any[] = [];
  const scope1Rows: any[] = [];
  const scope2Rows: any[] = [];
  const scope3Rows: any[] = [];

  for (const item of successful) {
    const tco2e = Number(item.result?.total_tco2e || 0);
    const kgco2e = Number(item.result?.co2e || 0);
    const category = String(item.result?.category || "").toLowerCase();
    const itemName = String(item.item_name || item.result?.item_name || "N/A");
    const activityId = String(item.result?.activity_id || "N/A");
    const qty = item.quantity ?? item.original_item?.quantity ?? item.converted?.value ?? "N/A";
    const unit = item.unit ?? item.original_item?.unit ?? item.converted?.unit ?? "N/A";
    const ef = item.result?.emission_factor || item.result?.emission_factor_kwh || "N/A";
    const efUnit = item.result?.emission_factor_unit || "kgCO2e/unit";
    const source = item.result?.data_source || item.result?.dataset_name || "Climatiq";
    const region = item.result?.region || "GB";
    const year = item.result?.year_released || new Date().getFullYear();

    const row = {
      item_name: itemName,
      quantity: qty,
      unit,
      kgco2e: formatNum(kgco2e, 3),
      tco2e: formatNum(tco2e, 4),
      emission_factor: typeof ef === "number" ? formatNum(ef, 5) : ef,
      ef_unit: efUnit,
      activity_id: activityId,
      source,
      region,
      year,
      category: item.result?.category || "N/A",
    };

    invoiceRows.push(row);

    const nameLow = itemName.toLowerCase();
    const actLow = activityId.toLowerCase();
    if (nameLow.includes("electricity") || category.includes("electricity") || actLow.includes("electricity")) {
      scope2 += tco2e;
      electricity += tco2e;
      if (String(unit).toLowerCase() === "kwh") totalEnergyKwh += Number(qty) || 0;
      scope2Rows.push(row);
    } else if (nameLow.includes("gas") || category.includes("gas") || actLow.includes("natural_gas")) {
      scope1 += tco2e;
      naturalGas += tco2e;
      scope1Rows.push(row);
    } else if (nameLow.includes("diesel") || category.includes("diesel") || category.includes("fuel")) {
      scope1 += tco2e;
      diesel += tco2e;
      scope1Rows.push(row);
    } else {
      scope3 += tco2e;
      scope3Rows.push(row);
    }
  }

  const totalTco2e = safeData.totalTCO2e || successful.reduce((s: number, r: any) => s + Number(r.result?.total_tco2e || 0), 0);
  const totalKgCO2e = safeData.totalKgCO2e || successful.reduce((s: number, r: any) => s + Number(r.result?.co2e || 0), 0);

  const total = results.length;
  const successPct = total > 0 ? Math.round((successful.length / total) * 100) : 0;
  const quality = successPct >= 90 ? "High" : successPct >= 70 ? "Medium" : "Low";

  function buildTableRows(rows: any[]) {
    if (!rows.length) return `<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:10px;">No data for this scope based on uploaded invoices</td></tr>`;
    return rows.map(r => `
      <tr>
        <td>${r.item_name}</td>
        <td>${r.quantity} ${r.unit}</td>
        <td>${r.emission_factor} ${r.ef_unit}</td>
        <td>${r.kgco2e} kgCO2e</td>
        <td>${r.tco2e} tCO2e</td>
        <td>${r.source}</td>
        <td>${r.year}</td>
      </tr>`).join("");
  }

  function buildInvoiceRegisterRows(rows: any[]) {
    if (!rows.length) return `<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:10px;">No invoice data available</td></tr>`;
    return rows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.item_name}</td>
        <td>${r.quantity} ${r.unit}</td>
        <td>${r.activity_id}</td>
        <td>${r.kgco2e} kgCO2e</td>
        <td>${r.tco2e} tCO2e</td>
      </tr>`).join("");
  }

  return {
    company_name: safeData.companyName || "CarbonSynq Demo Client",
    invoice_number: safeData.invoiceNumber || ("INV-" + Date.now().toString().slice(-6)),
    invoice_date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    reporting_period: "Invoice Upload Based Report",
    total_emissions: formatNum(totalTco2e, 4),
    total_kgco2e: formatNum(totalKgCO2e, 2),
    scope1: formatNum(scope1, 4),
    scope2: formatNum(scope2, 4),
    scope3: formatNum(scope3, 4),
    electricity: formatNum(electricity, 4),
    natural_gas: formatNum(naturalGas, 4),
    diesel: formatNum(diesel, 4),
    total_energy_kwh: formatNum(totalEnergyKwh, 2),
    country: "United Kingdom",
    recommendation: "Optimize energy consumption and switch to renewable sources. Procure renewable electricity contracts and install metering.",
    ceo_name: safeData.ceoName || "Authorised Signatory",
    items_processed: successful.length,
    items_failed: failed.length,
    items_total: total,
    data_quality: quality,
    data_quality_pct: successPct,
    invoice_rows_html: buildTableRows(invoiceRows),
    scope1_rows_html: buildTableRows(scope1Rows),
    scope2_rows_html: buildTableRows(scope2Rows),
    scope3_rows_html: buildTableRows(scope3Rows),
    invoice_register_html: buildInvoiceRegisterRows(invoiceRows),
  };
}
