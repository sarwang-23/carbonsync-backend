// UK Report Mapper - maps raw invoice payload to template data

export function buildUKReportData(commonData?: any) {
  const safeData = commonData || {};

  // ── Use the same scope computation as India BRSR (avoids logic duplication) ──
  // buildCommonData already correctly classifies Scope 1/2/3 using getInvoiceScopeInfo
  const results = safeData.calculationResults || [];
  const extractedItems = safeData.extractedItems || [];
  const successful = results.filter((r: any) => r.success);
  const failed = results.filter((r: any) => !r.success);

  const formatNum = (val: any, digits = 4) => Number(val || 0).toFixed(digits);

  // tco2e fallback: total_tco2e is sometimes 0, use co2e/1000
  const getTco2e = (r: any) => {
    const t = Number(r.result?.total_tco2e);
    if (t && t > 0) return t;
    return Number(r.result?.co2e || r.co2e || 0) / 1000;
  };

  // Scope 1: natural gas, diesel, fuel combustion (direct emissions)
  const isScope1 = (r: any) => {
    const name = String(r.item_name || r.result?.item_name || "").toLowerCase();
    const cat = String(r.result?.category || "").toLowerCase();
    const act = String(r.result?.activity_id || "").toLowerCase();
    return (
      name.includes("natural gas") || name.includes("gas bill") || name.includes("gas combustion") ||
      name.includes("diesel") || name.includes("petrol") || name.includes("fuel combustion") ||
      cat.includes("gaseous_fuels") || cat.includes("liquid_fuels") || cat.includes("combustion") ||
      act.includes("natural_gas") || act.includes("diesel") || act.includes("gaseous") ||
      act.includes("combustion") || act.includes("liquid_fuel") || act.includes("fuel")
    );
  };

  // Scope 2: electricity
  const isScope2 = (r: any) => {
    const name = String(r.item_name || r.result?.item_name || "").toLowerCase();
    const unit = String(r.unit || r.converted?.unit || "").toLowerCase();
    const cat = String(r.result?.category || "").toLowerCase();
    const act = String(r.result?.activity_id || "").toLowerCase();
    return (
      name.includes("electricity") || unit === "kwh" ||
      cat.includes("electricity") || act.includes("electricity")
    );
  };

  let scope1 = 0, scope2 = 0, scope3 = 0;
  let electricity = 0, naturalGas = 0, diesel = 0;
  let totalEnergyKwh = 0;
  const scope1Rows: any[] = [];
  const scope2Rows: any[] = [];
  const scope3Rows: any[] = [];
  const invoiceRows: any[] = [];

  for (const item of successful) {
    const tco2e = getTco2e(item);
    const kgco2e = Number(item.result?.co2e || item.co2e || 0);
    const itemName = String(item.item_name || item.result?.item_name || "N/A");
    const qty = item.quantity ?? item.original_item?.quantity ?? item.converted?.value ?? "N/A";
    const unit = item.unit ?? item.original_item?.unit ?? item.converted?.unit ?? "N/A";
    const ef = item.result?.emission_factor || item.result?.emission_factor_kwh || "N/A";
    const efUnit = item.result?.emission_factor_unit || "kgCO2e/unit";
    const source = item.result?.data_source || item.result?.dataset_name || "Climatiq";
    const year = item.result?.year_released || new Date().getFullYear();
    const activityId = String(item.result?.activity_id || "N/A");

    const row = {
      item_name: itemName,
      quantity: qty,
      unit,
      kgco2e: formatNum(kgco2e, 3),
      tco2e: formatNum(tco2e, 6),
      emission_factor: typeof ef === "number" ? formatNum(ef, 5) : ef,
      ef_unit: efUnit,
      activity_id: activityId,
      source,
      year,
      category: item.result?.category || "N/A",
    };

    invoiceRows.push(row);

    if (isScope2(item)) {
      scope2 += tco2e;
      electricity += tco2e;
      if (String(unit).toLowerCase() === "kwh") totalEnergyKwh += Number(qty) || 0;
      scope2Rows.push(row);
    } else if (isScope1(item)) {
      scope1 += tco2e;
      if (String(itemName).toLowerCase().includes("gas")) naturalGas += tco2e;
      else if (String(itemName).toLowerCase().includes("diesel")) diesel += tco2e;
      scope1Rows.push(row);
    } else {
      scope3 += tco2e;
      scope3Rows.push(row);
    }
  }

  const totalTco2e = safeData.totalTCO2e ||
    successful.reduce((s: number, r: any) => s + getTco2e(r), 0);
  const totalKgCO2e = safeData.totalKgCO2e ||
    successful.reduce((s: number, r: any) => s + Number(r.result?.co2e || r.co2e || 0), 0);

  const total = results.length;
  const successPct = total > 0 ? Math.round((successful.length / total) * 100) : 0;
  const quality = successPct >= 90 ? "High" : successPct >= 70 ? "Medium" : "Low";

  console.log(`🇬🇧 [UK Mapper] Computed → total:${formatNum(totalTco2e,4)} scope1:${formatNum(scope1,4)} scope2:${formatNum(scope2,4)} scope3:${formatNum(scope3,4)} items:${successful.length}/${total}`);

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
