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
    rawResponse
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
- Do not guess emission factors.
- Do not calculate CO2.
- Keep original invoice item names.
- Extract quantity and unit separately.
- If quantity and unit appear together like "18500 kWh", split them.
- If invoice is from Malaysia and currency is missing, use MYR.
- If data is not visible, return null.
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
