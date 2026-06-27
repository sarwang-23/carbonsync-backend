/**
 * Generic Invoice Line Item Extractor v4
 *
 * Broad fallback for OCR/Markdown invoices.
 * Fixes TIMBER_4 / Safety Net style where header is:
 * Sl No | Description of Goods | | Quantity | Rate | per Amount
 * and row is:
 * 1 | Safety Net ... | | 2,000.00 Sq.Mtr. | 140.00 | Sq.Mtr. 2,80,000.00
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
    if (/₹|rs\.?|inr|gstin|vat tin|pan no|india|mumbai|thane|maharashtra|thane jurisdiction/i.test(text)) return "INR";
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
    return /subtotal|sub\s*total|grand\s*total|sale\s*vat|vat|gst|cgst|sgst|igst|rounded|round\s*off|tax\b|amount\s+chargeable|amount\s+in\s+words|rupees\s*:/i.test(rowText);
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
    if (/net|safety\s*net|shade\s*net|fish\s*net|garware/i.test(itemName)) return "safety_or_plastic_net_product";
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
}): GenericExtractedLineItem {
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

function isBadItemName(name: string) {
    const n = cleanText(name);
    if (!n || n.length < 3) return true;
    if (!/[a-zA-Z]/.test(n)) return true;
    if (/invoice|dated|delivery|buyer|consignee|supplier|reference|despatch|destination|terms|email|phone|pan|tin|office|subject to|description of goods|quantity|rate|amount/i.test(n)) return true;
    if (isNonBillableRow(n)) return true;
    return false;
}

/**
 * Key fix for TIMBER_4:
 * Extract rows like:
 * | 1 | Safety Net ... | | 2,000.00 Sq.Mtr. | 140.00 | Sq.Mtr. 2,80,000.00 |
 */
function extractNumberedPipeRows(rawText: string): GenericExtractedLineItem[] {
    const text = String(rawText || "");
    const currency = detectCurrency(text);
    const country = detectCountry(text);
    const items: GenericExtractedLineItem[] = [];

    const rowRegex =
        /\|\s*(\d{1,4})\s*\|\s*([^|]{8,}?)\s*\|\s*(?:[^|]*\|\s*)?([\d,]+(?:\.\d+)?)\s*([A-Za-z.²0-9 ]{0,18})\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*([A-Za-z.²0-9 ]{0,18})\s*([\d,]+(?:\.\d+)?)\s*\|/gi;

    let match: RegExpExecArray | null;
    while ((match = rowRegex.exec(text)) !== null) {
        const slNo = toNumber(match[1]);
        const itemName = cleanText(match[2]);
        const quantity = toNumber(match[3]);
        const qtyUnit = cleanText(match[4]);
        const rate = toNumber(match[5]);
        const amountUnit = cleanText(match[6]);
        const amount = toNumber(match[7]);

        if (!slNo || isBadItemName(itemName)) continue;
        if (!quantity || !amount) continue;
        if (amount < 10) continue;

        const unit = normalizeUnit(qtyUnit || amountUnit, itemName);

        items.push(
            makeItem({
                itemName,
                quantity,
                unit,
                amount,
                currency,
                country,
                source: "generic_numbered_pipe_row_fallback",
                confidence: 0.84,
                parameters: {
                    row_no: slNo,
                    rate,
                    per: amountUnit || qtyUnit || null,
                    extraction_method: "numbered_pipe_row_regex",
                },
            })
        );
    }

    return items;
}

/**
 * Handles TIMBER_1:
 * | 1 | BWP Deco... | 2.13 X 0.78 | 67 | 111.31 | 2,139.83 | Sq.Mr. | 2,38,185.00 |
 */
function extractStandardEightCellRows(rawText: string): GenericExtractedLineItem[] {
    const text = String(rawText || "");
    const currency = detectCurrency(text);
    const country = detectCountry(text);
    const items: GenericExtractedLineItem[] = [];

    const rowRegex =
        /\|\s*(\d{1,4})\s*\|\s*([^|]{8,}?)\s*\|\s*([0-9.]+\s*[xX]\s*[0-9.]+)\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*([^|]{1,20})\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|/gi;

    let match: RegExpExecArray | null;
    while ((match = rowRegex.exec(text)) !== null) {
        const slNo = toNumber(match[1]);
        const itemName = cleanText(match[2]);
        const size = cleanText(match[3]);
        const pcs = toNumber(match[4]);
        const tableQty = toNumber(match[5]);
        const rate = toNumber(match[6]);
        const per = cleanText(match[7]);
        const amount = toNumber(match[8]);

        if (!slNo || isBadItemName(itemName)) continue;
        if (!amount) continue;

        const unit = normalizeUnit(per, itemName);
        const quantity = unit === "m2" && tableQty > 0 ? tableQty : pcs || tableQty;

        if (!quantity) continue;

        items.push(
            makeItem({
                itemName: `${itemName} (${size})`,
                quantity,
                unit,
                amount,
                currency,
                country,
                source: "generic_standard_8_cell_row_fallback",
                confidence: 0.86,
                parameters: {
                    row_no: slNo,
                    size,
                    pcs,
                    table_quantity: tableQty,
                    rate,
                    per,
                    extraction_method: "standard_8_cell_row_regex",
                },
            })
        );
    }

    return items;
}

/**
 * Last fallback for rows flattened by OCR:
 * Safety Net ... 2,000.00 Sq.Mtr. 140.00 Sq.Mtr. 2,80,000.00
 */
function extractFlatQuantityRateAmountRows(rawText: string): GenericExtractedLineItem[] {
    const text = String(rawText || "").replace(/\s+/g, " ");
    const currency = detectCurrency(text);
    const country = detectCountry(text);
    const items: GenericExtractedLineItem[] = [];

    const patterns = [
        /(?:\|\s*\d+\s*\|\s*)?([^|]{8,120}?(?:Net|Door|Shutter|Plywood|Steel|Aluminium|Cement|Textile|Fabric)[^|]{0,160}?)\s*\|\s*(?:\|\s*)?([\d,]+(?:\.\d+)?)\s*(Sq\.?\s*Mtr\.?|Sq\.?\s*Mr\.?|Sq\.?\s*Mt\.?|PCS|Nos|Kg|Kgs|MT|m2|kWh)\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*(?:Sq\.?\s*Mtr\.?|Sq\.?\s*Mr\.?|Sq\.?\s*Mt\.?|PCS|Nos|Kg|Kgs|MT|m2|kWh)?\s*([\d,]+(?:\.\d+)?)/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;

        const itemName = cleanText(match[1]).replace(/^\d+\s*\|\s*/, "");
        const quantity = toNumber(match[2]);
        const unit = normalizeUnit(match[3], itemName);
        const rate = toNumber(match[4]);
        const amount = toNumber(match[5]);

        if (isBadItemName(itemName)) continue;
        if (!quantity || !amount) continue;

        items.push(
            makeItem({
                itemName,
                quantity,
                unit,
                amount,
                currency,
                country,
                source: "generic_flat_quantity_rate_amount_fallback",
                confidence: 0.76,
                parameters: {
                    rate,
                    extraction_method: "flat_quantity_rate_amount_regex",
                },
            })
        );
    }

    return items;
}

function dedupe(items: GenericExtractedLineItem[]) {
    const seen = new Set<string>();
    return items.filter((item, idx) => {
        const key = [
            cleanText(item.item_name).toLowerCase(),
            Number(item.quantity || 0).toFixed(4),
            cleanText(item.unit).toLowerCase(),
            Number(item.amount || 0).toFixed(2),
            item.source,
            idx,
        ].join("|");

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function extractGenericInvoiceLineItems(rawText: string): GenericExtractedLineItem[] {
    const text = String(rawText || "");
    if (!text.trim()) return [];

    const items = dedupe([
        ...extractStandardEightCellRows(text),
        ...extractNumberedPipeRows(text),
        ...extractFlatQuantityRateAmountRows(text),
    ]);

    return items.filter((item) => {
        if (!item.item_name || !item.quantity || item.quantity <= 0) return false;
        if (item.amount !== null && item.amount <= 0) return false;
        return true;
    });
}
