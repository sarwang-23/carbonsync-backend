import fs from "fs";
import { Mistral } from "@mistralai/mistralai";
import type { NormalizedInvoice, NormalizedInvoiceItem } from "../types/invoice.types.js";

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const client = new Mistral({
  apiKey: MISTRAL_API_KEY || ""
});

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Mistral response did not contain valid JSON");
    }
    return JSON.parse(match[0]);
  }
}

function safeNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function getMimeType(filePath: string) {
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";

  return "application/pdf";
}

function normalizeMistralInvoice(parsed: any, rawResponse: any): NormalizedInvoice {
  const lineItems = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
  const currency = parsed.currency || "MYR";

  const normalizedItems: NormalizedInvoiceItem[] = lineItems
    .map((item: any) => ({
      name: String(item.name || item.description || "").trim(),
      description: item.description ? String(item.description).trim() : null,
      quantity: safeNumber(item.quantity),
      unit: item.unit ? String(item.unit).trim() : null,
      unitPrice: safeNumber(item.unitPrice),
      amount: safeNumber(item.amount),
      currency: item.currency || currency
    }))
    .filter((item: NormalizedInvoiceItem) => item.name.length > 0);

  return {
    provider: "mistral",
    vendorName: parsed.vendorName || null,
    invoiceNumber: parsed.invoiceNumber || null,
    invoiceDate: parsed.invoiceDate || null,
    currency,
    subtotal: safeNumber(parsed.subtotal),
    tax: safeNumber(parsed.tax),
    total: safeNumber(parsed.total),
    lineItems: normalizedItems,
    rawResponse,
    origin_station: parsed.origin_station || null,
    destination_station: parsed.destination_station || null,
    distance_km: safeNumber(parsed.distance_km),
    passenger_count: safeNumber(parsed.passenger_count),
    train_number: parsed.train_number || null,
    train_name: parsed.train_name || null,
    origin_airport: parsed.origin_airport || null,
    destination_airport: parsed.destination_airport || null,
    airline: parsed.airline || null,
    flight_number: parsed.flight_number || null,
    travel_class: parsed.travel_class || null,
  };
}

export async function extractInvoiceWithMistral(filePath: string): Promise<NormalizedInvoice> {
  if (!MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY missing");
  }

  const fileBuffer = fs.readFileSync(filePath);
  const base64 = fileBuffer.toString("base64");
  const mimeType = getMimeType(filePath);

  const prompt = `
You are an invoice extraction engine.

Extract invoice data from this document.

Return ONLY valid JSON with this structure:

{
  "vendorName": string | null,
  "invoiceNumber": string | null,
  "invoiceDate": string | null,
  "currency": string | null,
  "subtotal": number | null,
  "tax": number | null,
  "total": number | null,
  "origin_station": string | null,
  "destination_station": string | null,
  "train_number": string | null,
  "train_name": string | null,
  "distance_km": number | null,
  "passenger_count": number | null,
  "origin_airport": string | null,
  "destination_airport": string | null,
  "airline": string | null,
  "flight_number": string | null,
  "travel_class": string | null,
  "lineItems": [
    {
      "name": string,
      "description": string | null,
      "quantity": number | null,
      "unit": string | null,
      "unitPrice": number | null,
      "amount": number | null,
      "currency": string | null
    }
  ]
}

Rules:
- Return JSON only.
- Do not guess emission factors or calculate CO2.
- Keep original invoice item names.
- Extract quantity and unit separately.
- If quantity and unit appear together like "18500 kWh", split them.
- If invoice is from Malaysia and currency is missing, use MYR.
- If data is not visible, return null.
- FOR RAILWAY TICKETS (IRCTC, Indian Railways, PNR):
  * "origin_station": departure city or station code (e.g. "DLI", "Delhi", "NDLS")
  * "destination_station": arrival city or station code (e.g. "MFP", "Mumbai")
  * "train_number": train number if visible (e.g. "12554")
  * "train_name": train name if visible (e.g. "Vaishali Express")
  * "distance_km": numeric distance in km if explicitly printed on ticket
  * "passenger_count": number of passengers, default 1
  Even if distance_km is not on ticket, ALWAYS try to extract origin_station and destination_station.
- FOR FLIGHT TICKETS (e.g. IndiGo, Air India, PNR, MakeMyTrip):
  * "origin_airport": 3-letter IATA code (e.g. "PAT", "DEL", "BOM")
  * "destination_airport": 3-letter IATA code (e.g. "BOM", "BLR")
  * "airline": airline name (e.g. "IndiGo")
  * "flight_number": (e.g. "6E2167")
  * "passengers": number of passengers (default 1)
  * "travel_class": (e.g. "Economy")
  IGNORE line items like taxes, convenience fee, discount, baggage, seat, meal, insurance. ONLY extract the actual flight travel item.
`;

  const response = await client.chat.complete({
    model: "pixtral-large-latest",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt
          },
          {
            type: "document_url",
            documentUrl: `data:${mimeType};base64,${base64}`
          } as any
        ]
      }
    ],
    responseFormat: {
      type: "json_object"
    } as any
  });

  const content = response.choices?.[0]?.message?.content;

  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((c: any) => c.text || "").join("")
        : "";

  const parsed = safeJsonParse(text);

  return normalizeMistralInvoice(parsed, response);
}
