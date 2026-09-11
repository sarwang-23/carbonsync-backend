import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import type { NormalizedInvoice, NormalizedInvoiceItem } from "../types/invoice.types.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function getMimeType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/pdf";
}

function safeNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/,/g, "").replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error("Invalid JSON from Gemini");
    }
  }
}

export async function extractInvoiceWithGemini(filePath: string): Promise<NormalizedInvoice> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString("base64");
  const mimeType = getMimeType(filePath);

  const prompt = `You are an expert invoice and utility bill extraction AI for carbon emission accounting.
Analyze this invoice/receipt/ticket and extract all key data into valid JSON format.

Return ONLY valid JSON matching this exact structure:
{
  "vendorName": string | null,
  "vendorAddress": string | null,
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

Extraction guidelines:
- Extract ONLY true consumption or goods/service purchase line items.
- Electricity bills (e.g. TNB, MSEDCL, Tata Power): extract total kWh consumption into line items with unit "kWh".
- For railway tickets: extract origin_station, destination_station, distance_km, passenger_count, train_number.
- For flight tickets: extract 3-letter IATA airport codes in origin_airport & destination_airport, airline, flight_number.
- Do NOT include taxes, payment terms, or balance brought forward as line items.
- Return JSON strictly.`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const rawText = response.text || "";
  const parsed = safeJsonParse(rawText);

  const lineItems: NormalizedInvoiceItem[] = (Array.isArray(parsed.lineItems) ? parsed.lineItems : [])
    .map((item: any) => ({
      name: String(item.name || item.description || "").trim(),
      description: item.description ? String(item.description).trim() : null,
      quantity: safeNumber(item.quantity),
      unit: item.unit ? String(item.unit).trim() : null,
      unitPrice: safeNumber(item.unitPrice),
      amount: safeNumber(item.amount),
      currency: item.currency || parsed.currency || "INR",
    }))
    .filter((item: NormalizedInvoiceItem) => item.name.length > 0);

  return {
    provider: "gemini",
    vendorName: parsed.vendorName || null,
    vendorAddress: parsed.vendorAddress || null,
    invoiceNumber: parsed.invoiceNumber || null,
    invoiceDate: parsed.invoiceDate || null,
    currency: parsed.currency || "INR",
    subtotal: safeNumber(parsed.subtotal),
    tax: safeNumber(parsed.tax),
    total: safeNumber(parsed.total),
    lineItems,
    rawResponse: parsed,
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
