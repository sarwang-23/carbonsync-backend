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

function cleanText(text: string) {
    return String(text || "")
        .replace(/\u0000/g, " ")
        .replace(/\s+/g, " ")
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

    return cleanText(
        pages
            .map((page: any) => page?.markdown || page?.text || page?.content || "")
            .filter(Boolean)
            .join("\n\n")
    );
}

function extractTnbKwhFromText(rawText: string): number {
    const clean = String(rawText || "").replace(/,/g, "").replace(/\s+/g, " ");

    const patterns = [
        /(?:kegunaan|penggunaan|jumlah\s+penggunaan|usage|consumption)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:kwh)?/i,
        /(\d+(?:\.\d+)?)\s*kwh/i,
    ];

    for (const pattern of patterns) {
        const match = clean.match(pattern);
        if (match?.[1]) {
            const value = toNumber(match[1]);
            if (value > 0 && value < 100000) return value;
        }
    }

    const previousPattern = /(?:dahulu|previous|previous_reading|previous reading)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i;
    const currentPattern = /(?:semasa|current|current_reading|current reading)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i;

    const previous = toNumber(clean.match(previousPattern)?.[1]);
    const current = toNumber(clean.match(currentPattern)?.[1]);

    if (previous > 0 && current > previous) return current - previous;

    return 0;
}

function parseStructuredFromMistralText(text: string) {
    const lower = safeLower(text);
    const kwh = extractTnbKwhFromText(text);

    if (
        kwh > 0 &&
        (lower.includes("tenaga nasional") ||
            lower.includes("tnb") ||
            lower.includes("bil elektrik") ||
            lower.includes("kwh"))
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

    const line_items: any[] = [];
    const rows = text.split(/\n+/).map((row) => row.trim()).filter(Boolean);
    const unitRegex = /\b(m3|m³|cbm|cubic\s*meter|kg|kgs|ton|tons|tonne|tonnes|mt|pcs|pieces|nos|no|sqm|m2|m²)\b/i;
    const timberRegex = /(timber|wood|plywood|board|door|flush|laminated|veneer|meranti|teak|pine|rubberwood)/i;

    for (const row of rows) {
        if (!unitRegex.test(row) || !timberRegex.test(row)) continue;

        const qtyMatch = row.match(/(\d+(?:\.\d+)?)\s*(m3|m³|cbm|cubic\s*meter|kg|kgs|ton|tons|tonne|tonnes|mt|pcs|pieces|nos|no|sqm|m2|m²)\b/i);
        if (!qtyMatch) continue;

        const quantity = toNumber(qtyMatch[1]);
        const unit = qtyMatch[2];

        if (quantity <= 0) continue;

        const amountMatches = [...row.matchAll(/(?:rm|myr|inr|₹|\$)?\s*(\d{2,}(?:\.\d{1,2})?)\b/gi)]
            .map((m) => toNumber(m[1]))
            .filter((n) => n > 0);

        line_items.push({
            item_name: row.slice(0, 120),
            description: row,
            quantity,
            unit,
            amount: amountMatches.length ? amountMatches[amountMatches.length - 1] : null,
            currency: lower.includes("rm") ? "MYR" : lower.includes("inr") || lower.includes("₹") ? "INR" : null,
        });
    }

    if (line_items.length > 0) {
        return {
            document_type: "PURCHASED_GOODS",
            country: lower.includes("malaysia") || lower.includes("rm") ? "MY" : lower.includes("india") || lower.includes("inr") || lower.includes("₹") ? "IN" : "UNKNOWN",
            vendor: null,
            currency: lower.includes("rm") ? "MYR" : lower.includes("inr") || lower.includes("₹") ? "INR" : null,
            line_items,
            confidence: 0.7,
            warnings: ["Line items were parsed from Mistral OCR text using conservative timber/material rules."],
        };
    }

    return {
        document_type: "GENERIC_INVOICE",
        country: lower.includes("malaysia") || lower.includes("rm") ? "MY" : lower.includes("india") || lower.includes("inr") || lower.includes("₹") ? "IN" : "UNKNOWN",
        vendor: null,
        currency: lower.includes("rm") ? "MYR" : lower.includes("inr") || lower.includes("₹") ? "INR" : null,
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
