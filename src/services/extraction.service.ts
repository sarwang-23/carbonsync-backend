import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractTextWithOcr } from "./ocr.service.js";
import { extractInvoiceWithGeminiVision, convertVisionStructuredToLineItems } from "./vision.service.js";

export type ExtractionMethod =
    | "pdf_text"
    | "ocr_text"
    | "vision_placeholder"
    | "combined_pdf_ocr"
    | "failed";

export interface ExtractedLineItem {
    item_name: string;
    description?: string;
    quantity?: number;
    unit?: string;
    amount?: number | null;
    currency?: string | null;
    confidence?: number;
    source?: string;
    parameters?: Record<string, any>;
}

export interface InvoiceExtractionResult {
    success: boolean;
    method: ExtractionMethod;
    rawText: string;
    textLength: number;
    line_items: ExtractedLineItem[];
    warnings: string[];
    needs_review: boolean;
    confidence: number;
    audit: {
        fileName: string;
        filePath: string;
        mimetype?: string;
        pdfTextLength?: number;
        ocrTextLength?: number;
        extraction_steps: string[];
    };
}

function safeLower(value: any): string {
    return String(value || "").toLowerCase();
}

function toNumber(value: any): number {
    const num = Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "").trim());
    return Number.isFinite(num) ? num : 0;
}

function cleanText(text: string) {
    return String(text || "")
        .replace(/\u0000/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Extract text from digital PDFs using pdfjs.
 * This will work well for text PDFs, but scanned PDFs usually need OCR.
 */
export async function extractPdfText(filePath: string): Promise<string> {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    const pages: string[] = [];

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();

        const pageText = content.items
            .map((item: any) => item?.str || "")
            .filter(Boolean)
            .join(" ");

        pages.push(pageText);
    }

    return cleanText(pages.join("\n"));
}

/**
 * OCR placeholder.
 * Keep this function so your pipeline structure is ready.
 * You can connect existing Tesseract/Gemini OCR code here from app.ts.
 */
export async function extractOcrText(filePath: string, mimetype = ""): Promise<string> {
    const result = await extractTextWithOcr(filePath, mimetype, {
        maxPages: 3,
        scale: 2,
    });

    console.log("OCR_EXTRACTION_RESULT", {
        success: result.success,
        method: result.method,
        confidence: result.confidence,
        pages_processed: result.pages_processed,
        text_length: result.text.length,
        warnings: result.warnings,
    });

    return result.text || "";
}

/**
 * Vision placeholder.
 * Use Gemini Vision / Document AI later when PDF text + OCR are weak.
 */
export async function extractWithVisionPlaceholder(
    filePath: string,
    fileName = "",
    mimetype = ""
): Promise<{ text: string; lineItems: ExtractedLineItem[]; warnings: string[]; confidence: number }> {
    const result = await extractInvoiceWithGeminiVision({
        filePath,
        fileName,
        mimetype,
    });

    console.log("VISION_EXTRACTION_RESULT", {
        success: result.success,
        provider: result.provider,
        confidence: result.confidence,
        warnings: result.warnings,
    });

    return {
        text: result.rawText || "",
        lineItems: convertVisionStructuredToLineItems(result.structured),
        warnings: result.warnings || [],
        confidence: result.confidence || 0,
    };
}

export function extractMalaysiaTnbLineItem(text: string): ExtractedLineItem | null {
    const lower = safeLower(text);

    const isTnb =
        lower.includes("tenaga nasional") ||
        lower.includes("tnb") ||
        lower.includes("bil elektrik") ||
        lower.includes("kegunaan") ||
        lower.includes("caj semasa");

    if (!isTnb) return null;

    const clean = String(text || "")
        .replace(/,/g, "")
        .replace(/\s+/g, " ");

    const usagePatterns = [
        /(?:kegunaan\s*kwh|kegunaan|penggunaan|jumlah\s+penggunaan)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:kwh)?/i,
        /(?:jumlah)\s+(\d+(?:\.\d+)?)\s*(?:kwh)/i,
        /(\d+(?:\.\d+)?)\s*kwh/i,
    ];

    let kwh = 0;

    for (const pattern of usagePatterns) {
        const match = clean.match(pattern);
        if (match?.[1]) {
            const value = toNumber(match[1]);
            if (value > 0 && value < 100000) {
                kwh = value;
                break;
            }
        }
    }

    // Meter reading fallback: current - previous
    if (!kwh) {
        const meterPattern = /(?:dahulu|previous)\s*[:\-]?\s*(\d+(?:\.\d+)?).{0,80}(?:semasa|current)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i;
        const meterMatch = clean.match(meterPattern);

        if (meterMatch?.[1] && meterMatch?.[2]) {
            const previous = toNumber(meterMatch[1]);
            const current = toNumber(meterMatch[2]);
            if (current > previous) {
                kwh = current - previous;
            }
        }
    }

    if (!kwh) return null;

    const amountPatterns = [
        /(?:caj\s+semasa|jumlah\s+bil|jumlah\s+perlu\s+dibayar)\s*(?:rm)?\s*([\d.]+)/i,
        /rm\s*([\d.]+)/i,
    ];

    let amount: number | null = null;
    for (const pattern of amountPatterns) {
        const match = clean.match(pattern);
        if (match?.[1]) {
            const value = toNumber(match[1]);
            if (value > 0) {
                amount = value;
                break;
            }
        }
    }

    return {
        item_name: "TNB Malaysia Electricity Bill",
        description: "Malaysia grid electricity consumption",
        quantity: kwh,
        unit: "kWh",
        amount,
        currency: "MYR",
        confidence: 0.88,
        source: "tnb_extraction_rules",
        parameters: {
            energy: kwh,
            energy_kwh: kwh,
            energy_unit: "kWh",
            country: "MY",
            region: "MY",
            provider: "Tenaga Nasional Berhad",
            extraction_method: "tnb_text_rules",
        },
    };
}

export function extractGenericElectricityLineItem(text: string): ExtractedLineItem | null {
    const lower = safeLower(text);

    const isElectricity =
        lower.includes("electricity") ||
        lower.includes("electric bill") ||
        lower.includes("kwh") ||
        lower.includes("meter reading") ||
        lower.includes("energy charge");

    if (!isElectricity) return null;

    const clean = String(text || "")
        .replace(/,/g, "")
        .replace(/\s+/g, " ");

    const patterns = [
        /(?:total\s+consumption|electricity\s+consumption|energy\s+consumption|consumption|usage)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*kwh/i,
        /(\d+(?:\.\d+)?)\s*kwh/i,
    ];

    let kwh = 0;

    for (const pattern of patterns) {
        const match = clean.match(pattern);
        if (match?.[1]) {
            const value = toNumber(match[1]);
            if (value > 0 && value < 100000) {
                kwh = value;
                break;
            }
        }
    }

    if (!kwh) return null;

    return {
        item_name: "Electricity consumption",
        description: "Grid electricity consumption",
        quantity: kwh,
        unit: "kWh",
        confidence: 0.75,
        source: "generic_electricity_text_rules",
        parameters: {
            energy: kwh,
            energy_kwh: kwh,
            energy_unit: "kWh",
        },
    };
}

export function extractTrainTicketLineItem(text: string): ExtractedLineItem | null {
    const lower = safeLower(text);

    const isTrain =
        lower.includes("irctc") ||
        lower.includes("train no") ||
        lower.includes("railway") ||
        lower.includes("pnr");

    if (!isTrain) return null;

    const passengerMatch = text.match(/(?:passenger|passengers)\s*[:\-]?\s*(\d+)/i);
    const distanceMatch = text.match(/(?:distance|journey\s+distance)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*km/i);

    const passengerCount = passengerMatch?.[1] ? toNumber(passengerMatch[1]) : 1;
    const distanceKm = distanceMatch?.[1] ? toNumber(distanceMatch[1]) : 0;

    return {
        item_name: "India Train Ticket",
        description: "Passenger rail travel",
        quantity: distanceKm,
        unit: "passenger-km",
        confidence: distanceKm > 0 ? 0.8 : 0.45,
        source: "train_ticket_text_rules",
        parameters: {
            distance: distanceKm,
            distance_km: distanceKm,
            passenger_count: passengerCount,
            country: "IN",
            region: "IN",
        },
    };
}

export function extractFlightTicketLineItem(text: string): ExtractedLineItem | null {
    const lower = safeLower(text);

    const isFlight =
        lower.includes("boarding pass") ||
        lower.includes("flight no") ||
        lower.includes("flight number") ||
        lower.includes("airport") ||
        lower.includes("departure") ||
        lower.includes("arrival") ||
        lower.includes("indigo") ||
        lower.includes("air india") ||
        lower.includes("vistara");

    if (!isFlight) return null;

    const passengerMatch = text.match(/(?:passenger|passengers)\s*[:\-]?\s*(\d+)/i);
    const distanceMatch = text.match(/(?:distance|flight\s+distance)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*km/i);

    const passengerCount = passengerMatch?.[1] ? toNumber(passengerMatch[1]) : 1;
    const distanceKm = distanceMatch?.[1] ? toNumber(distanceMatch[1]) : 0;

    const originMatch = text.match(/(?:from|origin|departure)\s*[:\-]?\s*([A-Z]{3})/i);
    const destinationMatch = text.match(/(?:to|destination|arrival)\s*[:\-]?\s*([A-Z]{3})/i);

    return {
        item_name: "India Flight Ticket",
        description: "Passenger flight travel",
        quantity: distanceKm,
        unit: "passenger-km",
        confidence: distanceKm > 0 ? 0.8 : 0.45,
        source: "flight_ticket_text_rules",
        parameters: {
            distance: distanceKm,
            distance_km: distanceKm,
            passenger_count: passengerCount,
            origin: originMatch?.[1] || null,
            destination: destinationMatch?.[1] || null,
            country: "IN",
            region: "IN",
        },
    };
}

/**
 * Rule-based structured line extraction.
 * This does not guess values. It only returns items when values are found.
 */
export function extractStructuredLineItemsFromText(text: string): ExtractedLineItem[] {
    const items: ExtractedLineItem[] = [];

    const extractors = [
        extractMalaysiaTnbLineItem,
        extractGenericElectricityLineItem,
        extractTrainTicketLineItem,
        extractFlightTicketLineItem,
    ];

    for (const extractor of extractors) {
        const item = extractor(text);
        if (item) {
            items.push(item);
            break;
        }
    }

    return items;
}

/**
 * Main extraction pipeline.
 * Later you can plug existing OCR and Gemini Vision logic into placeholders.
 */
export async function extractInvoiceData(input: {
    filePath: string;
    fileName: string;
    mimetype?: string;
}): Promise<InvoiceExtractionResult> {
    const warnings: string[] = [];
    const extractionSteps: string[] = [];
    let pdfText = "";
    let ocrText = "";
    let visionText = "";
    let visionLineItems: ExtractedLineItem[] = [];
    let visionConfidence = 0;

    if (!input.filePath || !fs.existsSync(input.filePath)) {
        return {
            success: false,
            method: "failed",
            rawText: "",
            textLength: 0,
            line_items: [],
            warnings: [`File not found: ${input.filePath}`],
            needs_review: true,
            confidence: 0,
            audit: {
                fileName: input.fileName,
                filePath: input.filePath,
                mimetype: input.mimetype,
                extraction_steps: ["file_missing"],
            },
        };
    }

    try {
        const ext = path.extname(input.fileName || input.filePath).toLowerCase();

        if (input.mimetype === "application/pdf" || ext === ".pdf") {
            extractionSteps.push("pdf_text_extraction_started");
            pdfText = await extractPdfText(input.filePath);
            extractionSteps.push(`pdf_text_length_${pdfText.length}`);
        }
    } catch (error: any) {
        warnings.push(`PDF text extraction failed: ${error?.message || String(error)}`);
        extractionSteps.push("pdf_text_extraction_failed");
    }

    if (pdfText.length < 300) {
        try {
            extractionSteps.push("ocr_extraction_started");
            ocrText = await extractOcrText(input.filePath, input.mimetype || "");
            extractionSteps.push(`ocr_text_length_${ocrText.length}`);
        } catch (error: any) {
            warnings.push(`OCR extraction failed: ${error?.message || String(error)}`);
            extractionSteps.push("ocr_extraction_failed");
        }
    }

    if ((pdfText + " " + ocrText).trim().length < 300) {
        try {
            extractionSteps.push("vision_extraction_started");
            const visionResult = await extractWithVisionPlaceholder(
                input.filePath,
                input.fileName,
                input.mimetype || ""
            );
            visionText = visionResult.text;
            visionLineItems = visionResult.lineItems;
            visionConfidence = visionResult.confidence;
            warnings.push(...visionResult.warnings);
            extractionSteps.push(`vision_text_length_${visionText.length}`);
            extractionSteps.push(`vision_line_items_${visionLineItems.length}`);
        } catch (error: any) {
            warnings.push(`Vision extraction failed: ${error?.message || String(error)}`);
            extractionSteps.push("vision_extraction_failed");
        }
    }

    const rawText = cleanText([pdfText, ocrText, visionText].filter(Boolean).join("\n"));
    const lineItems = extractStructuredLineItemsFromText(rawText);
    if (!lineItems.length && visionLineItems.length) {
        lineItems.push(...visionLineItems);
    }

    let method: ExtractionMethod = "failed";
    if (pdfText.length >= 300 && ocrText.length > 0) method = "combined_pdf_ocr";
    else if (pdfText.length >= 300) method = "pdf_text";
    else if (ocrText.length >= 300) method = "ocr_text";
    else if (visionText.length >= 300) method = "vision_placeholder";

    const success = rawText.length > 0 || lineItems.length > 0;

    if (!lineItems.length) {
        warnings.push("No structured line items extracted from text. Calculation may need manual review or Vision extraction.");
    }

    return {
        success,
        method,
        rawText,
        textLength: rawText.length,
        line_items: lineItems,
        warnings,
        needs_review: !lineItems.length,
        confidence: lineItems.length ? Math.max(...lineItems.map((i) => Number(i.confidence || 0.6)), visionConfidence || 0) : 0.35,
        audit: {
            fileName: input.fileName,
            filePath: input.filePath,
            mimetype: input.mimetype,
            pdfTextLength: pdfText.length,
            ocrTextLength: ocrText.length,
            extraction_steps: extractionSteps,
        },
    };
}
