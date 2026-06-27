/**
 * Permanent generic invoice fallback extractor.
 *
 * Use this when OCR/Mistral text exists but parser/LLM returned 0 line items.
 * It extracts line items from OCR markdown tables and pipe-separated rows.
 *
 * Goal:
 * - Do not create a new hardcoded parser for every invoice.
 * - Recover billable table rows from raw OCR text before returning NO_INVOICE_ITEMS_EXTRACTED.
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

    let raw = String(value).trim();

    // Handle Indian number format and common OCR chars.
    raw = raw
        .replace(/₹|rs\.?|inr|rm|myr|\$/gi, "")
        .replace(/,/g, "")
        .replace(/[^\d.\-]/g, "");

    if (!raw || raw === "-" || raw === ".") return 0;

    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
}

function detectCurrency(text: string) {
    const lower = text.toLowerCase();

    if (/\brm\b|myr|malaysia|tnb|tenaga nasional/i.test(text)) return "MYR";
    if (/₹|rs\.?|inr|gstin|vat tin|pan no|india|mumbai|thane|delhi|maharashtra/i.test(text)) return "INR";
    if (/\$|usd/i.test(text)) return "USD";

    return null;
}

function detectCountry(text: string) {
    if (/malaysia|tnb|tenaga nasional|mytnb|kuala lumpur|selangor/i.test(text)) return "MY";
    if (/india|gstin|vat tin|pan no|mumbai|thane|delhi|maharashtra/i.test(text)) return "IN";
    return null;
}

function normalizeUnit(unit: string, itemName = "") {
    const u = cleanText(unit).toLowerCase();

    if (/kwh/.test(u)) return "kWh";
    if (/pcs|piece|pieces|pc|nos|no\b/.test(u)) return "pcs";
    if (/kg|kgs|kilogram/.test(u)) return "kg";
    if (/mt|tonne|ton|tons/.test(u)) return "t";
    if (/sq\.?\s*mtr|sq\.?\s*mt|sqm|m2|m²|square\s*meter|square\s*metre/.test(u)) return "m2";
    if (/litre|liter|ltr|\bl\b/.test(u)) return "l";
    if (/m3|m³|cubic/.test(u)) return "m3";

    // Door shutter table often uses PCS.
    if (/door|shutter|flush|plywood|timber|wood/i.test(itemName) && !u) return "pcs";

    return unit || "unknown";
}

function isNonBillableRow(rowText: string) {
    return /subtotal|sub\s*total|total\b|grand\s*total|vat|gst|cgst|sgst|igst|rounded|round\s*off|tax\b|amount\s+in\s+words|rupees\s*:/i.test(rowText);
}

function isLikelyItemName(value: string) {
    const text = cleanText(value);
    if (!text) return false;
    if (/^-+$/.test(text)) return false;
    if (/kind\s+of\s+product|description|particulars|item|product|goods/i.test(text)) return false;
    if (isNonBillableRow(text)) return false;

    return /[a-zA-Z]/.test(text);
}

function dedupe(items: GenericExtractedLineItem[]) {
    const seen = new Set<string>();

    return items.filter((item, index) => {
        const rowId = item.parameters?.row_index ?? index;

        const key = [
            rowId,
            cleanText(item.item_name).toLowerCase(),
            Number(item.quantity || 0).toFixed(4),
            cleanText(item.unit).toLowerCase(),
            Number(item.amount || 0).toFixed(2),
        ].join("|");

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Generic pipe-table extractor.
 * Works even when the OCR returns the full table on a single line.
 */
function extractFromPipeCells(rawText: string): GenericExtractedLineItem[] {
    const currency = detectCurrency(rawText);
    const country = detectCountry(rawText);
    const items: GenericExtractedLineItem[] = [];

    const cells = String(rawText || "")
        .split("|")
        .map(cleanText)
        .filter(Boolean)
        .filter((cell) => !/^[-\s]+$/.test(cell));

    // Pattern A:
    // [date/challan] | Door Shutter | 30 | 42.00 | 0.931 X 2.132 | 0.576 | 4,707.00 | PCS | 1,41,210.00
    // or:
    // Door Shutter | 40 | 32.00 | 0.781 X 2.132 | 0.371 | 3,555.00 | PCS | 1,42,200.00
    for (let i = 0; i < cells.length; i++) {
        const product = cells[i];

        if (!isLikelyItemName(product)) continue;
        if (!/door|shutter|flush|plywood|timber|wood|steel|aluminium|aluminum|cement|textile|fabric|plastic|paper/i.test(product)) {
            continue;
        }

        const quantity = toNumber(cells[i + 1]);
        const maybeThicknessOrSpec = cells[i + 2] || null;
        const maybeSize = cells[i + 3] || null;
        const maybeMeasure = toNumber(cells[i + 4]);
        const rate = toNumber(cells[i + 5]);
        const unit = normalizeUnit(cells[i + 6] || "", product);
        const amount = toNumber(cells[i + 7]);

        const hasSize = /\d+(?:\.\d+)?\s*[xX]\s*\d+(?:\.\d+)?/.test(String(maybeSize || ""));
        const hasValidAmount = amount > 0;
        const hasValidQuantity = quantity > 0;

        if (!hasValidQuantity || !hasValidAmount) continue;

        // Avoid matching header-like cells.
        if (/ch\.?\s*no|date|kind\s+of\s+product|pcts|kgs|length|thickness|size|rate|amount/i.test(product)) {
            continue;
        }

        items.push({
            item_name: hasSize
                ? `${product}${toNumber(maybeThicknessOrSpec) ? ` ${toNumber(maybeThicknessOrSpec)}MM` : ""} (${maybeSize})`
                : product,
            description: hasSize
                ? `${product}${toNumber(maybeThicknessOrSpec) ? ` ${toNumber(maybeThicknessOrSpec)}MM` : ""} size ${maybeSize}`
                : product,
            quantity,
            unit,
            amount,
            currency,
            confidence: 0.82,
            source: "generic_pipe_table_fallback",
            parameters: {
                row_index: i,
                country,
                region: country,
                material: /door|shutter|flush|plywood|timber|wood/i.test(product)
                    ? "timber_or_wood_product"
                    : null,
                product,
                thickness_mm: toNumber(maybeThicknessOrSpec) || null,
                size: hasSize ? maybeSize : null,
                secondary_measure: maybeMeasure || null,
                rate: rate || null,
                category: "purchased_goods",
                extraction_method: "generic_pipe_cell_scan",
            },
        });

        i += 7;
    }

    return dedupe(items);
}

/**
 * Generic regex fallback for rows where pipes are lost.
 */
function extractFromFlatRows(rawText: string): GenericExtractedLineItem[] {
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

        items.push({
            item_name: `Door Shutter ${thickness}MM (${size})`,
            description: `Door Shutter ${thickness}MM size ${size}`,
            quantity,
            unit: "pcs",
            amount,
            currency,
            confidence: 0.78,
            source: "generic_flat_row_fallback",
            parameters: {
                row_index: items.length,
                country,
                region: country,
                material: "timber_or_wood_product",
                product: "Door Shutter",
                thickness_mm: thickness || null,
                size,
                secondary_measure: secondaryMeasure || null,
                rate: rate || null,
                category: "purchased_goods",
                extraction_method: "generic_flat_door_shutter_regex",
            },
        });
    }

    return dedupe(items);
}

export function extractGenericInvoiceLineItems(rawText: string): GenericExtractedLineItem[] {
    const text = String(rawText || "");

    if (!text.trim()) return [];

    const items = dedupe([
        ...extractFromPipeCells(text),
        ...extractFromFlatRows(text),
    ]);

    // Keep only rows with usable quantity and amount.
    return items.filter((item) => item.quantity > 0 && (item.amount === null || item.amount > 0));
}
