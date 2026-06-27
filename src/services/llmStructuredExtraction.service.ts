/**
 * Generic LLM Structured Invoice Extraction
 *
 * Uses Gemini text API (no image required) to extract structured JSON
 * from raw invoice text when manual rule-based parsers return 0 line items.
 *
 * Required env:
 *   GEMINI_API_KEY=your_key
 *
 * Optional env:
 *   LLM_EXTRACTION_MODEL=gemini-2.0-flash-lite   (default)
 *   LLM_EXTRACTION_TIMEOUT_MS=15000
 *   DISABLE_LLM_EXTRACTION=true                  (to disable)
 */

function getEnvNumber(key: string, fallback: number): number {
    const val = Number(process.env[key]);
    return Number.isFinite(val) && val > 0 ? val : fallback;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(label)), ms);
        promise.then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
}

function safeJsonParse(text: string): any {
    // Strip markdown fences if present
    const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch {
        // Try to extract JSON object from surrounding text
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
            try {
                return JSON.parse(cleaned.slice(start, end + 1));
            } catch {
                return null;
            }
        }
        return null;
    }
}

function toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/,/g, "").replace(/[^\d.\-]/g, "");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
}

function normalizeLineItem(raw: any): any {
    if (!raw || typeof raw !== "object") return null;

    const itemName = String(raw.item_name || raw.description || "").trim();
    if (!itemName) return null;

    return {
        item_name: itemName,
        description: String(raw.description || raw.item_name || "").trim() || null,
        quantity: toNumber(raw.quantity) || null,
        unit: String(raw.unit || "").trim().toLowerCase() || null,
        amount: toNumber(raw.amount) || null,
        currency: String(raw.currency || "").toUpperCase().trim() || null,
        category: String(raw.category || "").toLowerCase().trim() || null,
        country: String(raw.country || "").toUpperCase().trim() || null,
        vendor: String(raw.vendor || "").trim() || null,
        confidence: 0.65,
        source: "llm_structured_extraction",
    };
}

export interface LlmExtractionResult {
    success: boolean;
    line_items: any[];
    rawJson: any;
    method: "llm_structured_extraction" | "llm_extraction_failed" | "llm_extraction_disabled";
    warnings: string[];
}

/**
 * Extract structured invoice data from raw text using Gemini LLM.
 * Call this after manual parsers have run and returned 0 line items.
 */
export async function extractStructuredInvoiceWithLLM(
    rawText: string,
    context?: { fileName?: string; mimetype?: string }
): Promise<LlmExtractionResult> {
    const warnings: string[] = [];

    if (process.env.DISABLE_LLM_EXTRACTION === "true") {
        return {
            success: false,
            line_items: [],
            rawJson: null,
            method: "llm_extraction_disabled",
            warnings: ["DISABLE_LLM_EXTRACTION=true. LLM extraction skipped."],
        };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return {
            success: false,
            line_items: [],
            rawJson: null,
            method: "llm_extraction_failed",
            warnings: ["GEMINI_API_KEY not set. LLM structured extraction skipped."],
        };
    }

    const truncatedText = rawText.slice(0, 12000); // Avoid token overflow

    const prompt = `You are an invoice data extraction engine for carbon emission accounting.

Given the following raw invoice text, extract structured line items for emission calculation.

IMPORTANT RULES:
- Extract ALL distinct products, materials, services, or energy/fuel items from the invoice.
- Do NOT invent or guess values not visible in the text.
- If quantity is not visible, return null for quantity.
- If unit is not visible, return null for unit.
- For electricity bills: item_name = "Electricity", unit = "kWh", quantity = total kWh usage.
- For fuel invoices: item_name = "Diesel" or "Petrol", unit = "l" or "litre".
- For water bills: item_name = "Water", unit = "m3".
- For materials (timber, steel, cement, etc): use item_name = the material name.
- category must be one of: electricity_bill, fuel, water, purchased_goods, transport_logistics, flight, rail, hotel, waste, unknown.
- country: 2-letter ISO code (IN, MY, GB, US, etc.) or null.
- Return ONLY a valid JSON object. No markdown, no explanation.

JSON schema:
{
  "vendor": string | null,
  "country": string | null,
  "currency": string | null,
  "invoice_type": string | null,
  "line_items": [
    {
      "item_name": string,
      "description": string | null,
      "quantity": number | null,
      "unit": string | null,
      "amount": number | null,
      "currency": string | null,
      "category": string | null,
      "country": string | null,
      "vendor": string | null
    }
  ]
}

Raw invoice text:
---
${truncatedText}
---`;

    const modelName = (process.env.LLM_EXTRACTION_MODEL || "gemini-2.0-flash-lite").trim();
    const timeoutMs = getEnvNumber("LLM_EXTRACTION_TIMEOUT_MS", 15000);

    try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey });

        console.log("LLM_STRUCTURED_EXTRACTION_STARTED", {
            modelName,
            textLength: truncatedText.length,
            fileName: context?.fileName,
        });

        const result = await withTimeout(
            ai.models.generateContent({
                model: modelName,
                contents: [{ text: prompt }],
            }),
            timeoutMs,
            `LLM extraction timed out after ${timeoutMs}ms`
        );

        const raw = result.text || "";
        const parsed = safeJsonParse(raw);

        if (!parsed) {
            warnings.push(`LLM returned unparseable response. Raw: ${raw.slice(0, 200)}`);
            return {
                success: false,
                line_items: [],
                rawJson: null,
                method: "llm_extraction_failed",
                warnings,
            };
        }

        const rawItems: any[] = Array.isArray(parsed.line_items) ? parsed.line_items : [];

        // Inherit top-level vendor/country/currency into each item if missing
        const topVendor = String(parsed.vendor || "").trim() || null;
        const topCountry = String(parsed.country || "").toUpperCase().trim() || null;
        const topCurrency = String(parsed.currency || "").toUpperCase().trim() || null;

        const lineItems = rawItems
            .map((raw) => {
                const item = normalizeLineItem(raw);
                if (!item) return null;
                return {
                    ...item,
                    vendor: item.vendor || topVendor,
                    country: item.country || topCountry,
                    currency: item.currency || topCurrency,
                };
            })
            .filter(Boolean);

        console.log("LLM_STRUCTURED_EXTRACTION_RESULT", {
            modelName,
            lineItemCount: lineItems.length,
            vendor: topVendor,
            country: topCountry,
            currency: topCurrency,
        });

        return {
            success: lineItems.length > 0,
            line_items: lineItems,
            rawJson: parsed,
            method: "llm_structured_extraction",
            warnings,
        };
    } catch (error: any) {
        const msg = error?.message || String(error);
        console.error("LLM_STRUCTURED_EXTRACTION_ERROR", { modelName, error: msg });
        warnings.push(`LLM structured extraction failed: ${msg}`);
        return {
            success: false,
            line_items: [],
            rawJson: null,
            method: "llm_extraction_failed",
            warnings,
        };
    }
}
