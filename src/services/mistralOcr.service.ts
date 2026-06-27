import fs from "fs";

export interface MistralOcrExtractionResult {
    success: boolean;
    provider: "mistral_ocr" | "disabled" | "failed";
    rawText: string;
    structured: any | null;
    confidence: number;
    warnings: string[];
}

function getEnvNumber(name: string, defaultValue: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    let timer: NodeJS.Timeout | null = null;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function cleanTextPreserveLines(text: string) {
    return String(text || "")
        .replace(/\u0000/g, " ")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function toNumber(value: any): number {
    const num = Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "").trim());
    return Number.isFinite(num) ? num : 0;
}

function safeLower(value: any): string {
    return String(value || "").toLowerCase().trim();
}

function normalizeMistralPages(data: any) {
    const pages = Array.isArray(data?.pages) ? data.pages : [];

    return cleanTextPreserveLines(
        pages
            .map((page: any) => page?.markdown || page?.text || page?.content || "")
            .filter(Boolean)
            .join("\n\n")
    );
}

function detectCountryAndCurrency(text: string) {
    const lower = safeLower(text);

    const currency =
        lower.includes("inr") ||
            text.includes("₹") ||
            lower.includes("maharashtra") ||
            lower.includes("mumbai") ||
            lower.includes("lucknow") ||
            lower.includes("indian rupees")
            ? "INR"
            : lower.includes("rm") ||
                lower.includes("myr") ||
                lower.includes("malaysia") ||
                lower.includes("bil elektrik") ||
                lower.includes("tenaga nasional") ||
                lower.includes("tnb")
                ? "MYR"
                : null;

    const country =
        currency === "INR" ? "IN" : currency === "MYR" ? "MY" : "UNKNOWN";

    return { country, currency };
}

function extractTnbKwhFromText(rawText: string): number {
    const original = String(rawText || "");
    const clean = original.replace(/,/g, "").replace(/\s+/g, " ");

    const candidates: number[] = [];

    function addCandidate(value: any) {
        const num = toNumber(value);
        if (num > 0 && num < 100000) candidates.push(num);
    }

    // Direct common patterns.
    const directPatterns = [
        /(?:jumlah\s+penggunaan|jumlah\s+kegunaan|total\s+usage|total\s+consumption)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:kwh)?/i,
        /(?:kegunaan|penggunaan|usage|consumption)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:kwh)?/i,
        /(\d+(?:\.\d+)?)\s*kwh/i,
    ];

    for (const pattern of directPatterns) {
        const match = clean.match(pattern);
        if (match?.[1]) addCandidate(match[1]);
    }

    // Mistral table pattern from TNB bills:
    // | Jumlah | 474 | | 166.78 |
    // | Kegunaan kWh | kWh | 300 | 174 | 474 |
    const tablePatterns = [
        /\|\s*\*\*Jumlah\*\*\s*\|\s*\*\*(\d+(?:\.\d+)?)\*\*/i,
        /\|\s*Jumlah\s*\|\s*(\d+(?:\.\d+)?)\s*\|/i,
        /Kegunaan\s*kWh\s*\|\s*kWh\s*\|\s*\d+(?:\.\d+)?\s*\|\s*\d+(?:\.\d+)?\s*\|\s*(\d+(?:\.\d+)?)/i,
        /Kegunaan\s*\|\s*Unit\s*[\s\S]{0,250}?\|\s*\d+\s*\|\s*\d+(?:\.\d+)?\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*kWh/i,
    ];

    for (const pattern of tablePatterns) {
        const match = original.match(pattern) || clean.match(pattern);
        if (match?.[1]) addCandidate(match[1]);
    }

    // Meter reading fallback:
    // | 3152072314 | 2192 | 2666 | 474 | kWh |
    const meterRow = clean.match(/\|\s*\d{6,}\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*kWh/i);
    if (meterRow?.[3]) addCandidate(meterRow[3]);

    const previousPattern = /(?:dahulu|previous|previous_reading|previous reading)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i;
    const currentPattern = /(?:semasa|current|current_reading|current reading)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i;

    const previous = toNumber(clean.match(previousPattern)?.[1]);
    const current = toNumber(clean.match(currentPattern)?.[1]);

    if (previous > 0 && current > previous) addCandidate(current - previous);

    // Prefer a plausible TNB usage value. In tariff rows, lower values like 200/300 can appear,
    // so choose the highest candidate when multiple table values are detected.
    if (candidates.length > 0) {
        return Math.max(...candidates);
    }

    return 0;
}

function normalizeUnit(unit: string) {
    const lower = safeLower(unit).replace(/\./g, "");

    if (lower.includes("sq") || lower.includes("m²") || lower.includes("m2")) return "m2";
    if (lower.includes("mt")) return "tonne";
    if (lower.includes("ton")) return "tonne";
    if (lower.includes("kg")) return "kg";
    if (lower.includes("m3") || lower.includes("m³") || lower.includes("cbm")) return "m3";
    if (lower.includes("pcs") || lower.includes("piece") || lower === "no" || lower === "nos") return "pcs";

    return unit || null;
}

function isMaterialDescription(description: string) {
    return /(timber|wood|pinewood|plywood|veneer|laminate|laminates|flush\s*door|door|board|mosaic|steel|aluminium|aluminum|cement|textile|fabric|iron|copper|plastic)/i.test(
        description || ""
    );
}

function parseMarkdownTableLineItems(text: string) {
    const { country, currency } = detectCountryAndCurrency(text);
    const lineItems: any[] = [];

    const rows = String(text || "")
        .split(/\n+/)
        .map((row) => row.trim())
        .filter((row) => row.includes("|"));

    for (const row of rows) {
        if (/^\|\s*-+/.test(row)) continue;

        const cells = row
            .split("|")
            .map((cell) => cell.trim())
            .filter((cell) => cell.length > 0);

        // Expected Mistral table:
        // Sl No | Description | Size | Pcs | Quantity | Rate | per | Amount
        if (cells.length < 7) continue;

        const slNo = toNumber(cells[0]);
        const description = cells[1] || "";

        if (!slNo || !isMaterialDescription(description)) continue;

        const size = cells[2] || null;
        const pcs = toNumber(cells[3]);
        const quantity = toNumber(cells[4]);
        const rate = toNumber(cells[5]);
        const unit = normalizeUnit(cells[6] || "");
        const amount = toNumber(cells[7]);

        if (quantity <= 0) continue;

        lineItems.push({
            item_name: description.slice(0, 120),
            description,
            quantity,
            unit,
            amount: amount || null,
            currency,
            confidence: 0.84,
            source: "mistral_markdown_table_rules",
            parameters: {
                material: safeLower(description),
                size,
                pcs: pcs || null,
                rate: rate || null,
                country,
                region: country,
                category: "purchased_goods",
                extraction_method: "mistral_markdown_table_rules",
            },
        });
    }

    return lineItems;
}

function parseFlattenedTableLineItems(text: string) {
    const { country, currency } = detectCountryAndCurrency(text);
    const lineItems: any[] = [];
    const flat = String(text || "").replace(/\n/g, " ");

    const rowRegex =
        /\|\s*(\d+)\s*\|\s*([^|]+?(?:timber|wood|pinewood|plywood|veneer|laminate|laminates|flush\s*door|door|board|mosaic|steel|aluminium|aluminum|cement|textile|fabric|iron|copper|plastic)[^|]*?)\s*\|\s*([^|]*?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*([\d,.]+)\s*\|\s*([\d,.]+)\s*\|\s*([^|]+?)\s*\|\s*([\d,.]+)\s*\|/gi;

    let match: RegExpExecArray | null;

    while ((match = rowRegex.exec(flat)) !== null) {
        const description = cleanTextPreserveLines(match[2]);
        const size = cleanTextPreserveLines(match[3]);
        const pcs = toNumber(match[4]);
        const quantity = toNumber(match[5]);
        const rate = toNumber(match[6]);
        const unit = normalizeUnit(match[7]);
        const amount = toNumber(match[8]);

        if (quantity <= 0) continue;

        lineItems.push({
            item_name: description.slice(0, 120),
            description,
            quantity,
            unit,
            amount: amount || null,
            currency,
            confidence: 0.82,
            source: "mistral_flattened_table_rules",
            parameters: {
                material: safeLower(description),
                size: size || null,
                pcs: pcs || null,
                rate: rate || null,
                country,
                region: country,
                category: "purchased_goods",
                extraction_method: "mistral_flattened_table_rules",
            },
        });
    }

    return lineItems;
}

function parseSimpleMaterialLineItem(text: string) {
    const { country, currency } = detectCountryAndCurrency(text);
    const clean = String(text || "").replace(/,/g, "").replace(/\s+/g, " ").trim();

    const materialPattern =
        /(steel|timber|wood|plywood|aluminium|aluminum|cement|textile|fabric|iron|copper|plastic)\s+(\d+(?:\.\d+)?)\s*(mt|tonnes?|tons?|kg|kgs|m3|m³|cbm|pcs|pieces|nos?|sqm|sq\.?\s*mr\.?|m2|m²)\b.{0,100}?(\d{2,}(?:\.\d{1,2})?)?/i;

    const match = clean.match(materialPattern);
    if (!match) return [];

    const material = match[1];
    const quantity = toNumber(match[2]);
    const unit = normalizeUnit(match[3]);

    if (quantity <= 0) return [];

    const amountCandidates = [...clean.matchAll(/\b(\d{3,}(?:\.\d{1,2})?)\b/g)]
        .map((m) => toNumber(m[1]))
        .filter((n) => n > 0);

    return [
        {
            item_name: `${material.toUpperCase()} material invoice`,
            description: `${material.toUpperCase()} purchased goods extracted from OCR text`,
            quantity,
            unit,
            amount: amountCandidates.length ? amountCandidates[amountCandidates.length - 1] : null,
            currency,
            confidence: 0.76,
            source: "simple_material_text_rules",
            parameters: {
                material: material.toLowerCase(),
                country,
                region: country,
                category: "purchased_goods",
                extraction_method: "simple_material_text_rules",
            },
        },
    ];
}

function parseStructuredFromMistralText(text: string) {
    const lower = safeLower(text);
    const { country, currency } = detectCountryAndCurrency(text);

    const kwh = extractTnbKwhFromText(text);

    if (
        kwh > 0 &&
        (
            lower.includes("tenaga nasional") ||
            lower.includes("tnb") ||
            lower.includes("bil elektrik") ||
            lower.includes("kwh")
        )
    ) {
        return {
            document_type: "ELECTRICITY_BILL",
            country: lower.includes("malaysia") || lower.includes("tnb") || lower.includes("tenaga nasional") ? "MY" : "UNKNOWN",
            vendor: lower.includes("tenaga nasional") || lower.includes("tnb") ? "TENAGA NASIONAL" : null,
            currency: lower.includes("rm") ? "MYR" : null,
            line_items: [
                {
                    item_name: "TNB Malaysia Electricity Bill",
                    description: "Grid electricity consumption extracted by Mistral OCR",
                    quantity: kwh,
                    unit: "kWh",
                    amount: null,
                    currency: lower.includes("rm") ? "MYR" : null,
                },
            ],
            electricity: {
                usage_kwh: kwh,
                previous_reading: null,
                current_reading: null,
                meter_difference_kwh: kwh,
            },
            confidence: 0.82,
            warnings: [],
        };
    }

    const lineItems = [
        ...parseMarkdownTableLineItems(text),
        ...parseFlattenedTableLineItems(text),
    ];

    if (!lineItems.length) {
        lineItems.push(...parseSimpleMaterialLineItem(text));
    }

    if (lineItems.length > 0) {
        return {
            document_type: "PURCHASED_GOODS",
            country,
            vendor: lower.includes("lucky ply") ? "LUCKY PLY & LAMINATES" : null,
            currency,
            line_items: lineItems,
            confidence: 0.82,
            warnings: [`Mistral OCR parsed ${lineItems.length} material line item(s).`],
        };
    }

    return {
        document_type: "GENERIC_INVOICE",
        country,
        vendor: null,
        currency,
        line_items: [],
        confidence: 0.55,
        warnings: ["Mistral OCR extracted text, but no structured line items were confidently detected."],
    };
}

async function mistralOcrRequest(input: {
    fileBase64: string;
    mimetype: string;
    fileName: string;
}) {
    const apiKey = process.env.MISTRAL_API_KEY;
    const model = process.env.MISTRAL_OCR_MODEL || "mistral-ocr-latest";
    const endpoint = process.env.MISTRAL_OCR_ENDPOINT || "https://api.mistral.ai/v1/ocr";

    const payload = {
        model,
        document: {
            type: "document_url",
            document_url: `data:${input.mimetype || "application/pdf"};base64,${input.fileBase64}`,
            document_name: input.fileName || "invoice",
        },
        include_image_base64: false,
    };

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const bodyText = await response.text();

    let data: any = null;
    try {
        data = JSON.parse(bodyText);
    } catch {
        data = { raw: bodyText };
    }

    if (!response.ok) {
        throw new Error(`Mistral OCR failed ${response.status}: ${bodyText.slice(0, 1000)}`);
    }

    return data;
}

export async function extractInvoiceWithMistralOcr(input: {
    filePath: string;
    fileName: string;
    mimetype?: string;
}): Promise<MistralOcrExtractionResult> {
    if (process.env.ENABLE_MISTRAL_OCR !== "true") {
        return {
            success: false,
            provider: "disabled",
            rawText: "",
            structured: null,
            confidence: 0,
            warnings: ["ENABLE_MISTRAL_OCR is not true. Mistral OCR fallback skipped."],
        };
    }

    if (!process.env.MISTRAL_API_KEY) {
        return {
            success: false,
            provider: "disabled",
            rawText: "",
            structured: null,
            confidence: 0,
            warnings: ["MISTRAL_API_KEY is not configured. Mistral OCR fallback skipped."],
        };
    }

    try {
        const fileBase64 = fs.readFileSync(input.filePath).toString("base64");
        const timeoutMs = getEnvNumber("MISTRAL_OCR_TIMEOUT_MS", 30000);

        const data = await withTimeout(
            mistralOcrRequest({
                fileBase64,
                fileName: input.fileName,
                mimetype: input.mimetype || "application/pdf",
            }),
            timeoutMs,
            `Mistral OCR timed out after ${timeoutMs}ms`
        );

        const rawText = normalizeMistralPages(data);
        const structured = parseStructuredFromMistralText(rawText);

        return {
            success: Boolean(rawText || structured?.line_items?.length),
            provider: "mistral_ocr",
            rawText,
            structured,
            confidence: Number(structured?.confidence || 0.7),
            warnings: [
                ...(structured?.warnings || []),
                `Mistral OCR extracted text length: ${rawText.length}`,
            ],
        };
    } catch (error: any) {
        return {
            success: false,
            provider: "failed",
            rawText: "",
            structured: null,
            confidence: 0,
            warnings: [error?.message || String(error)],
        };
    }
}
