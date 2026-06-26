import fs from "fs";

export interface VisionExtractionResult {
    success: boolean;
    provider: "gemini" | "disabled" | "failed";
    rawText: string;
    structured: any | null;
    confidence: number;
    warnings: string[];
}

/**
 * Optional Vision fallback.
 *
 * Use this only when PDF text + OCR are weak.
 *
 * Required env:
 * GEMINI_API_KEY=your_key
 *
 * Required package:
 * npm install @google/generative-ai
 */
export async function extractInvoiceWithGeminiVision(input: {
    filePath: string;
    fileName: string;
    mimetype?: string;
}): Promise<VisionExtractionResult> {
    const warnings: string[] = [];

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
        const { GoogleGenerativeAI } = await import("@google/generative-ai");

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_VISION_MODEL || "gemini-1.5-flash",
        });

        const fileBuffer = fs.readFileSync(input.filePath);
        const base64 = fileBuffer.toString("base64");

        const prompt = `
You are an invoice extraction engine for carbon emission calculation.

Extract visible data only. Do not guess. Do not invent values.

Return JSON only with this schema:
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

Important rules:
- For electricity bills, extract actual kWh usage. Do not use bill amount as kWh.
- For TNB Malaysia bills, prefer Kegunaan/Jumlah Penggunaan kWh or meter difference.
- If a value is not visible, return null.
- JSON only, no markdown.
`;

        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64,
                    mimeType: input.mimetype || "application/pdf",
                },
            },
            prompt,
        ]);

        const raw = result.response.text() || "";
        const cleaned = raw
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        let structured: any = null;

        try {
            structured = JSON.parse(cleaned);
        } catch {
            warnings.push("Gemini returned non-JSON output. Raw text returned for debugging.");
        }

        return {
            success: Boolean(structured),
            provider: "gemini",
            rawText: cleaned,
            structured,
            confidence: Number(structured?.confidence || 0.65),
            warnings: [...warnings, ...(structured?.warnings || [])],
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

export function convertVisionStructuredToLineItems(structured: any) {
    if (!structured) return [];

    const items: any[] = [];

    if (
        structured.document_type === "ELECTRICITY_BILL" &&
        structured.electricity?.usage_kwh
    ) {
        items.push({
            item_name:
                structured.vendor && String(structured.vendor).toLowerCase().includes("tenaga")
                    ? "TNB Malaysia Electricity Bill"
                    : "Electricity consumption",
            description: "Grid electricity consumption extracted by Vision fallback",
            quantity: Number(structured.electricity.usage_kwh),
            unit: "kWh",
            amount: structured.line_items?.[0]?.amount ?? null,
            currency: structured.currency || structured.line_items?.[0]?.currency || null,
            confidence: structured.confidence || 0.75,
            source: "vision_fallback",
            parameters: {
                energy: Number(structured.electricity.usage_kwh),
                energy_kwh: Number(structured.electricity.usage_kwh),
                energy_unit: "kWh",
                country: structured.country,
                vendor: structured.vendor,
                previous_reading: structured.electricity.previous_reading,
                current_reading: structured.electricity.current_reading,
                meter_difference_kwh: structured.electricity.meter_difference_kwh,
            },
        });

        return items;
    }

    if (
        structured.document_type === "TRAIN_TICKET" ||
        structured.document_type === "FLIGHT_TICKET"
    ) {
        items.push({
            item_name:
                structured.document_type === "TRAIN_TICKET"
                    ? "India Train Ticket"
                    : "India Flight Ticket",
            description:
                structured.document_type === "TRAIN_TICKET"
                    ? "Passenger rail travel extracted by Vision fallback"
                    : "Passenger flight travel extracted by Vision fallback",
            quantity: Number(structured.travel?.distance_km || 0),
            unit: "passenger-km",
            confidence: structured.confidence || 0.65,
            source: "vision_fallback",
            parameters: {
                distance: Number(structured.travel?.distance_km || 0),
                distance_km: Number(structured.travel?.distance_km || 0),
                passenger_count: Number(structured.travel?.passenger_count || 1),
                origin: structured.travel?.origin || null,
                destination: structured.travel?.destination || null,
                country: structured.country,
            },
        });

        return items;
    }

    if (Array.isArray(structured.line_items)) {
        return structured.line_items.map((item: any) => ({
            item_name: item.item_name || "Invoice item",
            description: item.description || null,
            quantity: item.quantity,
            unit: item.unit,
            amount: item.amount,
            currency: item.currency || structured.currency,
            confidence: structured.confidence || 0.6,
            source: "vision_fallback",
            parameters: {
                country: structured.country,
                vendor: structured.vendor,
            },
        }));
    }

    return items;
}
