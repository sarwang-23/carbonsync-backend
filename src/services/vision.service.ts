import fs from "fs";

export interface VisionExtractionResult {
    success: boolean;
    provider: "gemini" | "disabled" | "failed";
    rawText: string;
    structured: any | null;
    confidence: number;
    warnings: string[];
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeLower(value: any): string {
    return String(value || "").toLowerCase().trim();
}

function toNumber(value: any): number {
    const num = Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "").trim());
    return Number.isFinite(num) ? num : 0;
}

function getEnvNumber(name: string, defaultValue: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
): Promise<T> {
    let timer: NodeJS.Timeout | null = null;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error(timeoutMessage));
                }, timeoutMs);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function extractJsonFromText(raw: string): any | null {
    const cleaned = String(raw || "")
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch {
        // Continue with substring extraction.
    }

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
        try {
            return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        } catch {
            return null;
        }
    }

    return null;
}

function normalizeDocumentType(value: any): string {
    const text = safeLower(value).replace(/[\s-]+/g, "_");

    if (text.includes("electric")) return "ELECTRICITY_BILL";
    if (text.includes("train") || text.includes("rail")) return "TRAIN_TICKET";
    if (text.includes("flight") || text.includes("boarding")) return "FLIGHT_TICKET";
    if (text.includes("fuel") || text.includes("diesel") || text.includes("petrol")) return "FUEL_INVOICE";
    if (text.includes("water")) return "WATER_BILL";
    if (text.includes("waste")) return "WASTE_INVOICE";
    if (text.includes("hotel") || text.includes("accommodation")) return "HOTEL_INVOICE";
    if (text.includes("invoice")) return "GENERIC_INVOICE";

    return String(value || "UNKNOWN").toUpperCase();
}

function findElectricityUsageFromStructured(structured: any): number {
    const electricity = structured?.electricity || {};

    const direct =
        electricity.usage_kwh ??
        electricity.usageKwh ??
        electricity.kwh ??
        electricity.consumption_kwh ??
        electricity.consumptionKwh ??
        electricity.total_consumption_kwh ??
        electricity.totalConsumptionKwh ??
        electricity.meter_difference_kwh ??
        electricity.meterDifferenceKwh;

    if (toNumber(direct) > 0) return toNumber(direct);

    const previous = toNumber(
        electricity.previous_reading ??
            electricity.previousReading ??
            electricity.old_reading ??
            electricity.oldReading
    );

    const current = toNumber(
        electricity.current_reading ??
            electricity.currentReading ??
            electricity.new_reading ??
            electricity.newReading
    );

    if (previous > 0 && current > previous) {
        return current - previous;
    }

    if (Array.isArray(structured?.line_items)) {
        for (const item of structured.line_items) {
            const unit = safeLower(item?.unit);
            const name = safeLower(`${item?.item_name || ""} ${item?.description || ""}`);

            if (unit.includes("kwh") || name.includes("kwh") || name.includes("electric")) {
                const quantity = toNumber(item?.quantity);
                if (quantity > 0) return quantity;
            }
        }
    }

    return 0;
}

function findElectricityUsageFromRawText(rawText: string): number {
    const clean = String(rawText || "")
        .replace(/,/g, "")
        .replace(/\s+/g, " ");

    const patterns = [
        /"usage_kwh"\s*:\s*(\d+(?:\.\d+)?)/i,
        /"usageKwh"\s*:\s*(\d+(?:\.\d+)?)/i,
        /"meter_difference_kwh"\s*:\s*(\d+(?:\.\d+)?)/i,
        /"meterDifferenceKwh"\s*:\s*(\d+(?:\.\d+)?)/i,
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

    const previousPattern = /(?:dahulu|previous|previous_reading|previousReading)"?\s*[:\-]?\s*(\d+(?:\.\d+)?)/i;
    const currentPattern = /(?:semasa|current|current_reading|currentReading)"?\s*[:\-]?\s*(\d+(?:\.\d+)?)/i;

    const previous = toNumber(clean.match(previousPattern)?.[1]);
    const current = toNumber(clean.match(currentPattern)?.[1]);

    if (previous > 0 && current > previous) {
        return current - previous;
    }

    return 0;
}

function getGeminiModelCandidates() {
    const fromEnv = process.env.GEMINI_VISION_MODEL || "";
    const fallbackList = process.env.GEMINI_VISION_FALLBACK_MODELS || "";

    const candidates = [
        fromEnv,
        ...fallbackList.split(","),
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
    ]
        .map((model) => model.trim())
        .filter(Boolean);

    const unique = [...new Set(candidates)];
    const maxModels = getEnvNumber("GEMINI_VISION_MAX_MODELS", 2);

    return unique.slice(0, maxModels);
}

function isRetryableGeminiError(error: any) {
    const message = String(error?.message || error || "");
    const status = error?.status || error?.code || error?.response?.status;

    return (
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        message.includes('"code":503') ||
        message.includes("UNAVAILABLE") ||
        message.includes("high demand") ||
        message.includes("overloaded") ||
        message.includes("temporarily") ||
        message.includes("timed out")
    );
}

/**
 * Optional Gemini Vision fallback.
 *
 * Required env:
 * GEMINI_API_KEY=your_key
 *
 * Render-safe recommended env:
 * GEMINI_VISION_MODEL=gemini-2.5-flash-lite
 * GEMINI_VISION_FALLBACK_MODELS=gemini-2.0-flash-lite
 * GEMINI_VISION_TIMEOUT_MS=12000
 * GEMINI_VISION_MAX_MODELS=2
 *
 * Required package:
 * npm install @google/genai
 */
export async function extractInvoiceWithGeminiVision(input: {
    filePath: string;
    fileName: string;
    mimetype?: string;
}): Promise<VisionExtractionResult> {
    const warnings: string[] = [];

    if (process.env.DISABLE_VISION_EXTRACTION === "true") {
        return {
            success: false,
            provider: "disabled",
            rawText: "",
            structured: null,
            confidence: 0,
            warnings: ["DISABLE_VISION_EXTRACTION=true. Vision fallback skipped."],
        };
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            provider: "disabled",
            rawText: "",
            structured: null,
            confidence: 0,
            warnings: ["GEMINI_API_KEY is not configured. Vision fallback skipped."],
        };
    }

    try {
        const { GoogleGenAI } = await import("@google/genai");

        const ai = new GoogleGenAI({ apiKey });
        const fileBuffer = fs.readFileSync(input.filePath);
        const base64 = fileBuffer.toString("base64");

        const prompt = `
You are an invoice extraction engine for carbon emission calculation.

Extract visible data only. Do not guess. Do not invent values.

Return JSON only with this exact schema:
{
  "document_type": "ELECTRICITY_BILL | TRAIN_TICKET | FLIGHT_TICKET | FUEL_INVOICE | TRANSPORT_LOGISTICS | PURCHASED_GOODS | WATER_BILL | WASTE_INVOICE | HOTEL_INVOICE | GENERIC_INVOICE | UNKNOWN",
  "country": "IN | MY | UNKNOWN",
  "vendor": string | null,
  "currency": string | null,
  "invoice_date": string | null,
  "invoice_number": string | null,
  "line_items": [
    {
      "item_name": string,
      "description": string | null,
      "quantity": number | null,
      "unit": string | null,
      "amount": number | null,
      "currency": string | null
    }
  ],
  "electricity": {
    "usage_kwh": number | null,
    "previous_reading": number | null,
    "current_reading": number | null,
    "meter_difference_kwh": number | null
  },
  "travel": {
    "origin": string | null,
    "destination": string | null,
    "distance_km": number | null,
    "passenger_count": number | null
  },
  "confidence": number,
  "warnings": string[]
}

Important extraction rules:
- For electricity bills, extract actual kWh usage. Do not use bill amount as kWh.
- For TNB Malaysia bills, prefer Kegunaan/Jumlah Penggunaan kWh.
- If meter readings are visible, extract previous_reading and current_reading.
- If usage is not directly visible but meter readings are visible, set meter_difference_kwh = current_reading - previous_reading.
- If a value is not visible, return null.
- Return JSON only. No markdown.
`;

        const modelCandidates = getGeminiModelCandidates();
        const timeoutMs = getEnvNumber("GEMINI_VISION_TIMEOUT_MS", 12000);
        const maxAttempts = getEnvNumber("GEMINI_VISION_ATTEMPTS_PER_MODEL", 1);
        let lastError: any = null;

        for (const modelName of modelCandidates) {
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    console.log("GEMINI_VISION_MODEL_ACTIVE", {
                        modelName,
                        attempt,
                        timeoutMs,
                    });

                    const result = await withTimeout(
                        ai.models.generateContent({
                            model: modelName,
                            contents: [
                                {
                                    inlineData: {
                                        data: base64,
                                        mimeType: input.mimetype || "application/pdf",
                                    },
                                },
                                {
                                    text: prompt,
                                },
                            ],
                        }),
                        timeoutMs,
                        `Gemini Vision timed out after ${timeoutMs}ms for model ${modelName}`
                    );

                    const raw = result.text || "";
                    const cleaned = raw
                        .replace(/```json/gi, "")
                        .replace(/```/g, "")
                        .trim();

                    const structured = extractJsonFromText(cleaned);

                    if (!structured) {
                        warnings.push("Gemini returned non-JSON output. Raw text returned for fallback parsing.");
                    }

                    console.log("GEMINI_VISION_SUCCESS", {
                        modelName,
                        rawTextLength: cleaned.length,
                        structuredKeys: structured ? Object.keys(structured) : [],
                    });

                    return {
                        success: Boolean(structured || cleaned),
                        provider: "gemini",
                        rawText: cleaned,
                        structured,
                        confidence: Number(structured?.confidence || 0.65),
                        warnings: [...warnings, ...(structured?.warnings || [])],
                    };
                } catch (error: any) {
                    lastError = error;
                    const message = error?.message || String(error);

                    warnings.push(`Gemini model ${modelName} attempt ${attempt} failed: ${message}`);

                    console.warn("GEMINI_VISION_ATTEMPT_FAILED", {
                        modelName,
                        attempt,
                        message,
                    });

                    if (!isRetryableGeminiError(error)) {
                        break;
                    }

                    if (attempt < maxAttempts) {
                        await sleep(700 * attempt);
                    }
                }
            }
        }

        return {
            success: false,
            provider: "failed",
            rawText: "",
            structured: null,
            confidence: 0,
            warnings: [
                ...warnings,
                `All Gemini model attempts failed. Last error: ${lastError?.message || String(lastError)}`,
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

export function convertVisionStructuredToLineItems(structured: any, rawText = "") {
    const items: any[] = [];

    if (!structured && !rawText) return items;

    const documentType = normalizeDocumentType(structured?.document_type || structured?.documentType || "");
    const vendor = structured?.vendor || null;
    const country = structured?.country || "UNKNOWN";
    const currency = structured?.currency || structured?.line_items?.[0]?.currency || null;

    const kwhFromStructured = findElectricityUsageFromStructured(structured);
    const kwhFromRaw = findElectricityUsageFromRawText(rawText);
    const usageKwh = kwhFromStructured || kwhFromRaw;

    if ((documentType === "ELECTRICITY_BILL" || usageKwh > 0) && usageKwh > 0) {
        const electricity = structured?.electricity || {};

        items.push({
            item_name:
                vendor && String(vendor).toLowerCase().includes("tenaga")
                    ? "TNB Malaysia Electricity Bill"
                    : "Electricity consumption",
            description: "Grid Electricity Consumption",
            quantity: Number(usageKwh),
            unit: "kWh",
            amount: structured?.line_items?.[0]?.amount ?? null,
            currency,
            confidence: structured?.confidence || 0.75,
            source: "vision_fallback",
            parameters: {
                energy: Number(usageKwh),
                energy_kwh: Number(usageKwh),
                energy_unit: "kWh",
                country,
                vendor,
                previous_reading: electricity.previous_reading ?? electricity.previousReading ?? null,
                current_reading: electricity.current_reading ?? electricity.currentReading ?? null,
                meter_difference_kwh: electricity.meter_difference_kwh ?? electricity.meterDifferenceKwh ?? null,
            },
        });

        return items;
    }

    if (documentType === "TRAIN_TICKET" || documentType === "FLIGHT_TICKET") {
        const travel = structured?.travel || {};
        const distanceKm = Number(travel.distance_km || travel.distanceKm || 0);

        if (distanceKm > 0) {
            items.push({
                item_name:
                    documentType === "TRAIN_TICKET"
                        ? "India Train Ticket"
                        : "India Flight Ticket",
                description:
                    documentType === "TRAIN_TICKET"
                        ? "Passenger rail travel extracted by Vision fallback"
                        : "Passenger flight travel extracted by Vision fallback",
                quantity: distanceKm,
                unit: "passenger-km",
                confidence: structured?.confidence || 0.65,
                source: "vision_fallback",
                parameters: {
                    distance: distanceKm,
                    distance_km: distanceKm,
                    passenger_count: Number(travel.passenger_count || travel.passengerCount || 1),
                    origin: travel.origin || null,
                    destination: travel.destination || null,
                    country,
                },
            });

            return items;
        }
    }

    if (Array.isArray(structured?.line_items)) {
        return structured.line_items
            .filter((item: any) => item?.quantity || item?.amount || item?.item_name)
            .map((item: any) => ({
                item_name: item.item_name || "Invoice item",
                description: item.description || null,
                quantity: item.quantity,
                unit: item.unit,
                amount: item.amount,
                currency: item.currency || currency,
                confidence: structured?.confidence || 0.6,
                source: "vision_fallback",
                parameters: {
                    country,
                    vendor,
                },
            }));
    }

    return items;
}
