import axios from "axios";
import { classifyInvoiceDocument } from "./documentClassifier.service.js";

const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";

function getMistralApiKey() {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
        throw new Error("MISTRAL_API_KEY is missing");
    }
    return apiKey;
}

function getMistralExtractionModel() {
    return process.env.MISTRAL_EXTRACTION_MODEL || "mistral-small-latest";
}

function safeJsonParse(text: string) {
    const raw = String(text || "").trim();

    try {
        return JSON.parse(raw);
    } catch {
        // Try to extract JSON object from markdown/code text.
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("Mistral response did not contain JSON.");
        return JSON.parse(match[0]);
    }
}

function normalizeLineItems(items: any[] = []) {
    return items
        .map((item) => {
            const quantity = Number(String(item.quantity ?? 0).replace(/,/g, ""));
            const amount =
                item.amount === null || item.amount === undefined
                    ? null
                    : Number(String(item.amount).replace(/,/g, ""));

            return {
                item_name: String(item.item_name || item.description || "").trim(),
                description: String(item.description || item.item_name || "").trim(),
                quantity: Number.isFinite(quantity) ? quantity : 0,
                unit: String(item.unit || "unknown").trim(),
                amount: Number.isFinite(amount as number) ? amount : null,
                currency: item.currency || null,
                confidence: Number(item.confidence || 0.72),
                source: "mistral_llm_structured_extraction",
                parameters: {
                    ...(item.parameters || {}),
                    country: item.country || item.parameters?.country || null,
                    vendor: item.vendor || item.parameters?.vendor || null,
                    category: item.category || item.parameters?.category || null,
                    extraction_method: "mistral_llm_json_schema",
                },
            };
        })
        .filter((item) => item.item_name && (item.quantity > 0 || item.category === 'steel' || item.category === 'purchased_goods'));
}

/**
 * Generic structured invoice extraction using Mistral LLM.
 * Use this after OCR/manual parsers fail.
 */
export async function extractStructuredInvoiceWithMistral(rawText: string, fileName = "") {
    if (process.env.DISABLE_MISTRAL_LLM_EXTRACTION === "true") {
        return {
            success: false,
            line_items: [],
            warning: "Mistral LLM extraction disabled by DISABLE_MISTRAL_LLM_EXTRACTION=true",
        };
    }

    const apiKey = getMistralApiKey();
    const model = getMistralExtractionModel();

    // Stage 1: Document type detection
    const classification = classifyInvoiceDocument({ text: rawText, fileName });
    const detectedCategory = classification.category;

    // Stage 2: Industry-specific extraction prompt
    let industryInstructions = "";
    
    // Check if it's steel/manufacturing using both classifier and explicit keywords
    const lowerText = String(rawText || "").toLowerCase();
    const isSteel = detectedCategory === "purchased_goods" || 
        ["steel", "ms billet", "billet", "tmt", "tmt bar", "round bar", "rebar", "structural steel", "coil", "wire rod", "beam", "angle", "channel"].some(kw => lowerText.includes(kw));

    if (isSteel) {
        industryInstructions = `
- THIS INVOICE BELONGS TO THE STEEL/MANUFACTURING INDUSTRY.
- Scan ALL table columns for quantity/weight data. Look for columns named: Qty, Quantity, Weight, Net Weight, Gross Weight, MT, Ton, KG, Net Wt, Gr Wt.
- If quantity is written as MT, M/T, M.T., Metric Ton, Ton, Tonne → set unit to "tonne".
- If quantity is written in KG, KGS → set unit to "kg".
- ALWAYS populate parameters.weight, parameters.net_weight, and parameters.gross_weight with numeric values if they appear ANYWHERE on the invoice.
- DO NOT leave quantity null if any numeric quantity or weight exists on the invoice.
- If the main quantity column is missing or unclear, use net_weight or gross_weight AS the quantity.
- Example: "19.850 M/T" → quantity: 19.85, unit: "tonne"
- Example: "1280 KG" → quantity: 1280, unit: "kg"
- If a row has MULTIPLE numeric weight columns, prefer: Net Weight > Gross Weight > Total Weight.`;
    } else if (detectedCategory === "fuel") {
        industryInstructions = `
- THIS INVOICE BELONGS TO THE FUEL INDUSTRY.
- Extract fuel type and volume accurately, prefer litres or gallons for unit.`;
    } else if (detectedCategory === "flight_ticket") {
        industryInstructions = `
- THIS INVOICE BELONGS TO THE AIR TRAVEL INDUSTRY.
- Extract origin airport, destination airport, flight class, and number of passengers.`;
    }

    const prompt = `
You are an invoice line-item extraction engine.

Extract structured line items from the invoice OCR text.

Rules:
- Return ONLY valid JSON.
- Do not add markdown.
- If table rows exist, extract every billable row.
- Do not extract subtotal, VAT/GST, rounded off, total, previous balance, or payment notice as line items.
- Prefer actual quantity columns such as Pcs/Kgs/Quantity/Usage/kWh/MT/kg/litre/m3.
- For electricity bills, extract total kWh consumption, not the first slab.
- For timber/door invoices, extract product rows like Door Shutter, Flush Door, Plywood, Timber.
- For amount, use line item amount only.
- Currency should be INR for Indian invoices, MYR for Malaysia invoices.
- Country should be IN or MY where possible.
- Category should be one of: electricity_bill, purchased_goods, fuel, water, waste, transport_logistics, hotel, unknown.${industryInstructions ? "\n" + industryInstructions : ""}
- FOR RAILWAY TICKETS (IRCTC, Indian Railways, PNR, train number): At the TOP LEVEL also extract:
  * "origin_station": departure city or station code (e.g. "DLI", "Delhi", "New Delhi")
  * "destination_station": arrival city or station code (e.g. "MFP", "NDLS", "Mumbai")
  * "train_number": train number if visible (e.g. "12554"), else null
  * "train_name": train name if visible (e.g. "Vaishali Express"), else null
  * "distance_km": numeric distance in km if printed on ticket, else null
  * "passenger_count": number of passengers (default 1)
  ALWAYS extract origin_station and destination_station even if distance_km is null.
  For the line item: category = "transport_logistics", unit = "passenger-km" if distance_km known, else unit = "ticket", quantity = distance_km * passenger_count (or 1 if unknown).


JSON schema:
{
  "document_type": "string",
  "country": "IN | MY | UNKNOWN",
  "vendor": "string | null",
  "currency": "INR | MYR | USD | null",
  "origin_station": "string | null",
  "destination_station": "string | null",
  "train_number": "string | null",
  "train_name": "string | null",
  "distance_km": "number | null",
  "passenger_count": "number | null",
  "line_items": [
    {
      "item_name": "string",
      "description": "string",
      "quantity": number,
      "unit": "string",
      "amount": number | null,
      "currency": "string | null",
      "category": "string",
      "country": "string",
      "vendor": "string | null",
      "confidence": number,
      "parameters": {
        "size": "string | null",
        "rate": number | null,
        "thickness_mm": number | null,
        "weight": "number | null",
        "net_weight": "number | null",
        "gross_weight": "number | null",
        "hsn": "string | null",
        "grade": "string | null",
        "material": "string | null"
      }
    }
  ]
}

File name: ${fileName}

OCR text:
${String(rawText || "").slice(0, 12000)}
`;

    const response = await axios.post(
        MISTRAL_CHAT_URL,
        {
            model,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            timeout: Number(process.env.MISTRAL_LLM_TIMEOUT_MS || 45000),
        }
    );

    const content = response.data?.choices?.[0]?.message?.content || "";
    const parsed = safeJsonParse(content);
    const lineItems = normalizeLineItems(parsed?.line_items || []);

    return {
        success: lineItems.length > 0,
        method: "mistral_llm_structured_extraction",
        document_type: parsed?.document_type || "UNKNOWN",
        country: parsed?.country || "UNKNOWN",
        vendor: parsed?.vendor || null,
        currency: parsed?.currency || null,
        // Railway fields
        origin_station: parsed?.origin_station || null,
        destination_station: parsed?.destination_station || null,
        train_number: parsed?.train_number || null,
        train_name: parsed?.train_name || null,
        distance_km: parsed?.distance_km != null ? Number(parsed.distance_km) : null,
        passenger_count: parsed?.passenger_count != null ? Number(parsed.passenger_count) : null,
        line_items: lineItems,
        confidence: lineItems.length > 0 ? 0.78 : 0.35,
        warnings: lineItems.length > 0 ? [] : ["Mistral LLM returned no line items."],
    };
}
