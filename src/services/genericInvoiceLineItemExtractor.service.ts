/**
 * Generic Invoice Line Item Extractor v2
 *
 * Permanent fallback for OCR text tables.
 * Handles:
 * - Header-aware tables: Description/Kind of Product + Size + Pcs + Quantity + Rate + Per + Amount
 * - TIMBER_1 style: Sl No | Description | Size | Pcs | Quantity | Rate | per | Amount
 * - TIMBER_3 style: Ch.No | Kind of Product | Pcts/Kgs | Length/Thickness | Size | Cubic Ft/Sq.Mtrs | Rate | Per | Amount
 * - Flattened Door Shutter rows
 */

export type GenericExtractedLineItem = {
    item_name: string;
    description: string;
    quantity: number;
    unit: string;
    amount: number | null;
    currency: string | null;
    confidence: number;
    source: string;
    parameters: Record<string, any>;
};

function cleanText(value: any) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toNumber(value: any): number {
    if (value === null || value === undefined) return 0;

    const raw = String(value)
        .replace(/₹|rs\.?|inr|rm|myr|\$/gi, "")
        .replace(/,/g, "")
        .replace(/[^\d.\-]/g, "")
        .trim();

    if (!raw || raw === "-" || raw === ".") return 0;

    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
}

function detectCurrency(text: string) {
    if (/\brm\b|myr|malaysia|tnb|tenaga nasional/i.test(text)) return "MYR";
    if (/₹|rs\.?|inr|gstin|vat tin|pan no|india|mumbai|thane|maharashtra/i.test(text)) return "INR";
    if (/\$|usd/i.test(text)) return "USD";
    return null;
}

function detectCountry(text: string) {
    if (/malaysia|tnb|tenaga nasional|mytnb|kuala lumpur|selangor/i.test(text)) return "MY";
    if (/india|gstin|vat tin|pan no|mumbai|thane|maharashtra/i.test(text)) return "IN";
    return null;
}

function normalizeUnit(unit: string, itemName = "") {
    const u = cleanText(unit).toLowerCase();

    if (/kwh/.test(u)) return "kWh";
    if (/pcs|piece|pieces|pc|nos|no\b/.test(u)) return "pcs";
    if (/kg|kgs|kilogram/.test(u)) return "kg";
    if (/mt|tonne|ton|tons/.test(u)) return "t";
    if (/sq\.?\s*m|sq\.?\s*mtr|sq\.?\s*mr|sq\.?\s*mt|sqm|m2|m²|square\s*meter|square\s*metre/.test(u)) return "m2";
    if (/litre|liter|ltr|\bl\b/.test(u)) return "l";
    if (/m3|m³|cubic|cft|cu\.?\s*ft/.test(u)) return "m3";

    if (/door|shutter|flush|plywood|timber|wood/i.test(itemName) && !u) return "pcs";
    return unit || "unknown";
}

function isNonBillableRow(rowText: string) {
    return /subtotal|sub\s*total|total\b|grand\s*total|vat|gst|cgst|sgst|igst|rounded|round\s*off|tax\b|amount\s+chargeable|amount\s+in\s+words|rupees\s*:/i.test(rowText);
}

function isLikelyItemName(value: string) {
    const text = cleanText(value);
    if (!text) return false;
    if (/^-+$/.test(text)) return false;
    if (isNonBillableRow(text)) return false;
    if (/description\s+of\s+goods|kind\s+of\s+product|particulars|quantity|amount|rate|size/i.test(text)) return false;
    return /[a-zA-Z]/.test(text);
}

function isMaterialName(value: string) {
    return /door|shutter|flush|plywood|timber|wood|veneer|laminate|steel|aluminium|aluminum|cement|textile|fabric|plastic|paper/i.test(value);
}

function dedupe(items: GenericExtractedLineItem[]) {
    // Do not remove repeated invoice rows blindly.
    // Some invoices legitimately repeat same item/quantity/amount as separate billable rows.
    return items;
}

function makeItem(input: {
    itemName: string;
    quantity: number;
    unit: string;
    amount: number | null;
    currency: string | null;
    country: string | null;
    source: string;
    confidence: number;
    parameters?: Record<string, any>;
}) {
    return {
        item_name: input.itemName,
        description: input.itemName,
        quantity: input.quantity,
        unit: normalizeUnit(input.unit, input.itemName),
        amount: input.amount,
        currency: input.currency,
        confidence: input.confidence,
        source: input.source,
        parameters: {
            country: input.country,
            region: input.country,
            category: "purchased_goods",
            material: isMaterialName(input.itemName) ? "material_or_purchased_goods" : null,
            ...(input.parameters || {}),
        },
    };
}

/**
 * Header-aware pipe table extraction.
 *
 * Converts all pipe cells into rows using detected header width.
 */
function extractHeaderAwarePipeTables(rawText: string): GenericExtractedLineItem[] {
    const currency = detectCurrency(rawText);
    const country = detectCountry(rawText);
    const items: GenericExtractedLineItem[] = [];

    const cells = String(rawText || "")
        .split("|")
        .map(cleanText)
        .filter(Boolean)
        .filter((cell) => !/^[-\s]+$/.test(cell));

    for (let h = 0; h < cells.length; h++) {
        const headerSlice = cells.slice(h, h + 12);
        const headerText = headerSlice.join(" | ").toLowerCase();

        const hasDesc = /description\s+of\s+goods|kind\s+of\s+product|particulars|description/.test(headerText);
        const hasAmount = /\bamount\b/.test(headerText);
        const hasRate = /\brate\b/.test(headerText);
        const hasUnit = /\bper\b|unit/.test(headerText);

        if (!hasDesc || !hasAmount || !hasRate) continue;

        // Determine the header end at Amount column.
        const amountRel = headerSlice.findIndex((c) => /\bamount\b/i.test(c));
        if (amountRel < 0) continue;

        const header = headerSlice.slice(0, amountRel + 1);
        const width = header.length;

        const descIdx = header.findIndex((c) => /description|kind\s+of\s+product|particulars/i.test(c));
        const sizeIdx = header.findIndex((c) => /\bsize\b/i.test(c));
        const pcsIdx = header.findIndex((c) => /pcs|pcts|kgs/i.test(c));
        const qtyIdx = header.findIndex((c) => /^quantity$/i.test(c));
        const thicknessIdx = header.findIndex((c) => /length|thickness/i.test(c));
        const measureIdx = header.findIndex((c) => /cubic|sq\.?\s*m|sq\.?\s*mtrs/i.test(c));
        const rateIdx = header.findIndex((c) => /\brate\b/i.test(c));
        const perIdx = header.findIndex((c) => /\bper\b|unit/i.test(c));
        const amountIdx = header.findIndex((c) => /\bamount\b/i.test(c));

        if (descIdx < 0 || amountIdx < 0) continue;

        let cursor = h + width;

        while (cursor + width <= cells.length) {
            let row = cells.slice(cursor, cursor + width);
            let rowText = row.join(" ");

            // Stop/skip on non item rows.
            if (isNonBillableRow(rowText)) {
                cursor += width;
                continue;
            }

            let itemName = cleanText(row[descIdx]);

            // Some TIMBER_3 subsequent rows have no first date cell and row shifts left:
            // Door Shutter | 40 | 32.00 | size | measure | rate | PCS | amount
            // In this case descIdx from header may be 1 but row[0] is actual item.
            if (!isLikelyItemName(itemName) && isLikelyItemName(row[0]) && isMaterialName(row[0])) {
                const shifted = ["", ...row].slice(0, width);
                row = shifted;
                rowText = row.join(" ");
                itemName = cleanText(row[descIdx]);
            }

            if (!isLikelyItemName(itemName) || !isMaterialName(itemName)) {
                cursor += width;
                continue;
            }

            const amount = toNumber(row[amountIdx]);
            const pcs = pcsIdx >= 0 ? toNumber(row[pcsIdx]) : 0;
            const qty = qtyIdx >= 0 ? toNumber(row[qtyIdx]) : 0;
            const rate = rateIdx >= 0 ? toNumber(row[rateIdx]) : 0;
            const unitRaw = perIdx >= 0 ? row[perIdx] : "";

            if (!amount || amount <= 0) {
                cursor += width;
                continue;
            }

            // If "Quantity" column exists and "per" is Sq.Mtr/m2, use quantity.
            // Otherwise use pcs/pcts/kgs.
            const normalizedUnit = normalizeUnit(unitRaw, itemName);
            const quantity =
                qty > 0 && normalizedUnit === "m2"
                    ? qty
                    : qty > 0 && pcs <= 0
                      ? qty
                      : pcs > 0
                        ? pcs
                        : qty;

            if (!quantity || quantity <= 0) {
                cursor += width;
                continue;
            }

            const size = sizeIdx >= 0 ? row[sizeIdx] : null;
            const thickness = thicknessIdx >= 0 ? toNumber(row[thicknessIdx]) : null;
            const secondaryMeasure = measureIdx >= 0 ? toNumber(row[measureIdx]) : null;

            const fullName = [
                itemName,
                thickness ? `${thickness}MM` : "",
                size && /\d/.test(size) ? `(${size})` : "",
            ]
                .filter(Boolean)
                .join(" ");

            items.push(
                makeItem({
                    itemName: fullName,
                    quantity,
                    unit: normalizedUnit,
                    amount,
                    currency,
                    country,
                    source: "generic_header_aware_table_fallback",
                    confidence: 0.84,
                    parameters: {
                        product: itemName,
                        size: size || null,
                        pcs: pcs || null,
                        table_quantity: qty || null,
                        thickness_mm: thickness || null,
                        secondary_measure: secondaryMeasure || null,
                        rate: rate || null,
                        per: unitRaw || null,
                        extraction_method: "header_aware_pipe_table",
                        row_index: cursor,
                    },
                })
            );

            cursor += width;
        }
    }

    return dedupe(items);
}

/**
 * Pipe-cell fallback for rows without perfect header mapping.
 */
function extractMaterialPipeCellScan(rawText: string): GenericExtractedLineItem[] {
    const currency = detectCurrency(rawText);
    const country = detectCountry(rawText);
    const items: GenericExtractedLineItem[] = [];

    const cells = String(rawText || "")
        .split("|")
        .map(cleanText)
        .filter(Boolean)
        .filter((cell) => !/^[-\s]+$/.test(cell));

    for (let i = 0; i < cells.length; i++) {
        const product = cells[i];

        if (!isLikelyItemName(product) || !isMaterialName(product)) continue;

        // TIMBER_3 shape:
        // product | pcs | thickness | size | measure | rate | PCS | amount
        const pcsA = toNumber(cells[i + 1]);
        const thicknessA = toNumber(cells[i + 2]);
        const sizeA = cells[i + 3];
        const measureA = toNumber(cells[i + 4]);
        const rateA = toNumber(cells[i + 5]);
        const unitA = normalizeUnit(cells[i + 6], product);
        const amountA = toNumber(cells[i + 7]);

        if (pcsA > 0 && amountA > 0 && /\d+(?:\.\d+)?\s*[xX]\s*\d+(?:\.\d+)?/.test(sizeA || "")) {
            items.push(
                makeItem({
                    itemName: `${product}${thicknessA ? ` ${thicknessA}MM` : ""} (${sizeA})`,
                    quantity: pcsA,
                    unit: unitA,
                    amount: amountA,
                    currency,
                    country,
                    source: "generic_pipe_cell_scan_fallback",
                    confidence: 0.82,
                    parameters: {
                        product,
                        thickness_mm: thicknessA || null,
                        size: sizeA,
                        secondary_measure: measureA || null,
                        rate: rateA || null,
                        per: cells[i + 6] || null,
                        extraction_method: "pipe_cell_material_scan",
                        row_index: i,
                    },
                })
            );
            i += 7;
            continue;
        }

        // TIMBER_1 shape:
        // slno | product | size | pcs | quantity | rate | per | amount
        // If loop currently at product cell:
        const sizeB = cells[i + 1];
        const pcsB = toNumber(cells[i + 2]);
        const qtyB = toNumber(cells[i + 3]);
        const rateB = toNumber(cells[i + 4]);
        const unitB = normalizeUnit(cells[i + 5], product);
        const amountB = toNumber(cells[i + 6]);

        if (qtyB > 0 && amountB > 0 && /\d+(?:\.\d+)?\s*[xX]\s*\d+(?:\.\d+)?/.test(sizeB || "")) {
            const quantity = unitB === "m2" ? qtyB : pcsB || qtyB;

            items.push(
                makeItem({
                    itemName: `${product} (${sizeB})`,
                    quantity,
                    unit: unitB,
                    amount: amountB,
                    currency,
                    country,
                    source: "generic_pipe_cell_scan_fallback",
                    confidence: 0.82,
                    parameters: {
                        product,
                        size: sizeB,
                        pcs: pcsB || null,
                        table_quantity: qtyB || null,
                        rate: rateB || null,
                        per: cells[i + 5] || null,
                        extraction_method: "pipe_cell_material_scan_timber1",
                        row_index: i,
                    },
                })
            );
            i += 6;
        }
    }

    return dedupe(items);
}

function extractFlatDoorRows(rawText: string): GenericExtractedLineItem[] {
    const currency = detectCurrency(rawText);
    const country = detectCountry(rawText);
    const items: GenericExtractedLineItem[] = [];
    const text = String(rawText || "").replace(/\s+/g, " ");

    const doorRegex =
        /Door\s+Shutter\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+([0-9.]+\s*[xX]\s*[0-9.]+)\s+(\d+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+PCS\s+([\d,]+(?:\.\d+)?)/gi;

    let match: RegExpExecArray | null;
    while ((match = doorRegex.exec(text)) !== null) {
        const quantity = toNumber(match[1]);
        const thickness = toNumber(match[2]);
        const size = cleanText(match[3]);
        const secondaryMeasure = toNumber(match[4]);
        const rate = toNumber(match[5]);
        const amount = toNumber(match[6]);

        if (!quantity || !amount) continue;

        items.push(
            makeItem({
                itemName: `Door Shutter ${thickness}MM (${size})`,
                quantity,
                unit: "pcs",
                amount,
                currency,
                country,
                source: "generic_flat_row_fallback",
                confidence: 0.78,
                parameters: {
                    product: "Door Shutter",
                    thickness_mm: thickness || null,
                    size,
                    secondary_measure: secondaryMeasure || null,
                    rate: rate || null,
                    per: "PCS",
                    extraction_method: "flat_door_shutter_regex",
                },
            })
        );
    }

    return dedupe(items);
}

export function extractGenericInvoiceLineItems(rawText: string): GenericExtractedLineItem[] {
    const text = String(rawText || "");
    if (!text.trim()) return [];

    const items = dedupe([
        ...extractHeaderAwarePipeTables(text),
        ...extractMaterialPipeCellScan(text),
        ...extractFlatDoorRows(text),
    ]);

    return items.filter((item) => {
        if (!item.item_name || !item.quantity || item.quantity <= 0) return false;
        if (item.amount !== null && item.amount <= 0) return false;
        return true;
    });
}
