/**
 * Generic Invoice Line Item Extractor v3
 *
 * Broader fallback for OCR/Markdown tables.
 * Handles non-timber invoices too:
 * - Safety Net / Construction material
 * - Timber / Door / Plywood
 * - Steel / Aluminium / Cement / Textile / Plastic etc.
 *
 * Important:
 * This extractor does NOT require item names to match a hardcoded material list.
 * If a row has description + quantity + rate + amount, it can extract it.
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

    if (/door|shutter|flush|plywood|timber|wood|net|safety/i.test(itemName) && !u) return "pcs";
    return unit || "unknown";
}

function isNonBillableRow(rowText: string) {
    return /subtotal|sub\s*total|total\b|grand\s*total|vat|gst|cgst|sgst|igst|rounded|round\s*off|tax\b|amount\s+chargeable|amount\s+in\s+words|rupees\s*:/i.test(rowText);
}

function isHeaderText(text: string) {
    return /description\s+of\s+goods|kind\s+of\s+product|particulars|quantity|amount|rate|size|sl\s*no|pcts|kgs/i.test(text);
}

function isLikelyItemName(value: string) {
    const text = cleanText(value);
    if (!text) return false;
    if (/^-+$/.test(text)) return false;
    if (isNonBillableRow(text)) return false;
    if (isHeaderText(text)) return false;
    if (!/[a-zA-Z]/.test(text)) return false;

    // Avoid addresses / metadata as item rows
    if (/invoice|dated|delivery|buyer|consignee|supplier|reference|despatch|destination|terms|email|phone|pan|tin|office|subject to/i.test(text)) return false;

    return true;
}

function inferCategory(itemName: string) {
    if (/electricity|kwh|tenaga|tnb/i.test(itemName)) return "electricity_bill";
    if (/fuel|diesel|petrol|gasoline/i.test(itemName)) return "fuel";
    if (/water|m3|sewerage/i.test(itemName)) return "water";
    return "purchased_goods";
}

function inferMaterial(itemName: string) {
    if (/door|shutter|flush|plywood|timber|wood|veneer|laminate/i.test(itemName)) return "timber_or_wood_product";
    if (/steel|iron|tmt|bar|rod/i.test(itemName)) return "steel_or_metal_product";
    if (/aluminium|aluminum/i.test(itemName)) return "aluminium_product";
    if (/cement|concrete/i.test(itemName)) return "cement_or_concrete_product";
    if (/textile|fabric|cloth/i.test(itemName)) return "textile_product";
    if (/net|safety\s*net|shade\s*net|fish\s*net/i.test(itemName)) return "safety_or_plastic_net_product";
    return "purchased_goods";
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
    const itemName = cleanText(input.itemName);

    return {
        item_name: itemName,
        description: itemName,
        quantity: input.quantity,
        unit: normalizeUnit(input.unit, itemName),
        amount: input.amount,
        currency: input.currency,
        confidence: input.confidence,
        source: input.source,
        parameters: {
            country: input.country,
            region: input.country,
            category: inferCategory(itemName),
            material: inferMaterial(itemName),
            ...(input.parameters || {}),
        },
    };
}

function dedupe(items: GenericExtractedLineItem[]) {
    // Keep repeated invoice rows. Repeated rows may be valid billable rows.
    return items;
}

/**
 * Header-aware table extraction.
 * Finds rows based on headers and does not require product keyword matching.
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
        const hasQty = /\bquantity\b|pcs|pcts|kgs/.test(headerText);
        const hasAmount = /\bamount\b/.test(headerText);
        const hasRate = /\brate\b/.test(headerText);

        if (!hasDesc || !hasQty || !hasAmount || !hasRate) continue;

        const amountRel = headerSlice.findIndex((c) => /\bamount\b/i.test(c));
        if (amountRel < 0) continue;

        const header = headerSlice.slice(0, amountRel + 1);
        const width = header.length;

        const descIdx = header.findIndex((c) => /description|kind\s+of\s+product|particulars/i.test(c));
        const sizeIdx = header.findIndex((c) => /\bsize\b/i.test(c));
        const pcsIdx = header.findIndex((c) => /pcs|pcts|kgs/i.test(c));
        const qtyIdx = header.findIndex((c) => /quantity/i.test(c));
        const rateIdx = header.findIndex((c) => /\brate\b/i.test(c));
        const perIdx = header.findIndex((c) => /\bper\b|unit/i.test(c));
        const amountIdx = header.findIndex((c) => /\bamount\b/i.test(c));

        if (descIdx < 0 || amountIdx < 0) continue;

        let cursor = h + width;

        while (cursor + width <= cells.length) {
            let row = cells.slice(cursor, cursor + width);
            let rowText = row.join(" ");

            if (isNonBillableRow(rowText)) {
                cursor += width;
                continue;
            }

            let itemName = cleanText(row[descIdx]);

            // If a row is shifted left due missing empty cells, try shifting.
            if (!isLikelyItemName(itemName) && isLikelyItemName(row[0])) {
                const shifted = ["", ...row].slice(0, width);
                row = shifted;
                rowText = row.join(" ");
                itemName = cleanText(row[descIdx]);
            }

            if (!isLikelyItemName(itemName)) {
                cursor += width;
                continue;
            }

            const amount = toNumber(row[amountIdx]);
            const pcs = pcsIdx >= 0 ? toNumber(row[pcsIdx]) : 0;
            const qty = qtyIdx >= 0 ? toNumber(row[qtyIdx]) : 0;
            const rate = rateIdx >= 0 ? toNumber(row[rateIdx]) : 0;
            const unitRaw = perIdx >= 0 ? row[perIdx] : "";
            const normalizedUnit = normalizeUnit(unitRaw, itemName);

            if (!amount || amount <= 0) {
                cursor += width;
                continue;
            }

            const quantity =
                qty > 0
                    ? qty
                    : pcs > 0
                      ? pcs
                      : rate > 0 && amount > 0
                        ? amount / rate
                        : 0;

            if (!quantity || quantity <= 0) {
                cursor += width;
                continue;
            }

            const size = sizeIdx >= 0 ? row[sizeIdx] : null;

            const fullName = size && /\d/.test(size)
                ? `${itemName} (${size})`
                : itemName;

            items.push(
                makeItem({
                    itemName: fullName,
                    quantity,
                    unit: normalizedUnit,
                    amount,
                    currency,
                    country,
                    source: "generic_header_aware_table_fallback",
                    confidence: 0.82,
                    parameters: {
                        product: itemName,
                        size: size || null,
                        pcs: pcs || null,
                        table_quantity: qty || null,
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
 * Flexible single-row scanner:
 * Sl No | Description | Quantity | Rate | per Amount
 * or
 * Description | | 2,000.00 Sq.Mtr. | 140.00 | Sq.Mtr. 2,80,000.00
 */
function extractFlexibleRows(rawText: string): GenericExtractedLineItem[] {
    const currency = detectCurrency(rawText);
    const country = detectCountry(rawText);
    const items: GenericExtractedLineItem[] = [];

    const rows = String(rawText || "")
        .split(/\n|(?=\|\s*\d+\s*\|)/g)
        .map(cleanText)
        .filter((row) => row.includes("|"));

    for (const row of rows) {
        if (isNonBillableRow(row)) continue;

        const cells = row
            .split("|")
            .map(cleanText)
            .filter(Boolean)
            .filter((cell) => !/^[-\s]+$/.test(cell));

        if (cells.length < 5) continue;

        // Find the most likely description cell.
        const descIndex = cells.findIndex((cell) => isLikelyItemName(cell) && /[a-zA-Z]{3,}/.test(cell));
        if (descIndex < 0) continue;

        const desc = cells[descIndex];

        // Find amount: usually last large money value.
        const numericCells = cells.map((cell, idx) => ({ cell, idx, num: toNumber(cell) }));
        const amountCandidate = [...numericCells]
            .reverse()
            .find((x) => x.num > 0 && x.idx > descIndex && /[\d,]+\.\d{2}/.test(x.cell));

        if (!amountCandidate) continue;

        // Find quantity+unit after description.
        let quantity = 0;
        let unit = "unknown";
        let rate = 0;

        for (let i = descIndex + 1; i < amountCandidate.idx; i++) {
            const cell = cells[i];
            const num = toNumber(cell);

            if (!quantity && num > 0) {
                quantity = num;
                unit = normalizeUnit(cell, desc);
            }

            // rate is usually next numeric before amount
            if (num > 0 && i !== amountCandidate.idx) {
                rate = num;
            }

            const unitMatch = cell.match(/(Sq\.?\s*Mtr\.?|Sq\.?\s*Mr\.?|Sq\.?\s*Mt\.?|PCS|Nos|Kg|Kgs|MT|m2|kWh)/i);
            if (unitMatch && unit === "unknown") {
                unit = normalizeUnit(unitMatch[1], desc);
            }
        }

        // Sometimes quantity and unit are in same cell: "2,000.00 Sq.Mtr."
        const qtyUnitCell = cells.slice(descIndex + 1, amountCandidate.idx).find((cell) => /\d/.test(cell) && /(Sq|PCS|Nos|Kg|MT|m2|kWh)/i.test(cell));
        if (qtyUnitCell) {
            quantity = toNumber(qtyUnitCell);
            const unitMatch = qtyUnitCell.match(/(Sq\.?\s*Mtr\.?|Sq\.?\s*Mr\.?|Sq\.?\s*Mt\.?|PCS|Nos|Kg|Kgs|MT|m2|kWh)/i);
            if (unitMatch) unit = normalizeUnit(unitMatch[1], desc);
        }

        if (!quantity || quantity <= 0) continue;

        items.push(
            makeItem({
                itemName: desc,
                quantity,
                unit,
                amount: amountCandidate.num,
                currency,
                country,
                source: "generic_flexible_row_fallback",
                confidence: 0.76,
                parameters: {
                    product: desc,
                    rate: rate || null,
                    extraction_method: "flexible_pipe_row_scan",
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
        ...extractFlexibleRows(text),
    ]);

    return items.filter((item) => {
        if (!item.item_name || !item.quantity || item.quantity <= 0) return false;
        if (item.amount !== null && item.amount <= 0) return false;
        return true;
    });
}
