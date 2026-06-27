import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractInvoiceWithMistralOcr as extractInvoiceWithOcr } from "./ocr.service.js";
import { extractInvoiceWithGeminiVision, convertVisionStructuredToLineItems } from "./vision.service.js";
import { extractInvoiceWithMistralOcr } from "./mistralOcr.service.js";
import {
    shouldBlockScannedPdfInFreeMode,
    buildScannedPdfFreeModeExtractionResult,
} from "./scannedPdfGuard.service.js";
import { extractStructuredInvoiceWithLLM } from "./llmStructuredExtraction.service.js";
import { extractStructuredInvoiceWithMistral } from "./mistralStructuredExtraction.service.js";
import { extractGenericInvoiceLineItems } from "./genericInvoiceLineItemExtractor.service.js";
import { extractElectricityBillLineItems } from "./electricityBillFallbackExtractor.service.js";
import { resolveFinalInvoiceLineItems } from "./finalInvoiceLineItemResolver.service.js";

export type ExtractionMethod =
    | "pdf_text"
    | "ocr_text"
    | "vision_placeholder"
    | "mistral_ocr"
    | "mistral_ocr_llm"
    | "combined_pdf_ocr"
    | "llm_structured_extraction"
    | "generic_ocr_table_fallback"
    | "electricity_bill_fallback"
    | "final_line_item_resolver"
    | "failed"
    | "scanned_pdf_blocked_free_mode";

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
    error_type?: string;
    message?: string;
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
export async function extractOcrDetailed(filePath: string, mimetype = "") {
    // ocr.service.ts now uses Mistral OCR; Tesseract has been removed.
    // This stub preserves the expected shape { success, text, method, confidence, pages_processed, warnings }.
    const mistralResult = await extractInvoiceWithOcr({ filePath, fileName: "", mimetype });
    const text = mistralResult.rawText || "";

    const result = {
        success: mistralResult.success,
        text,
        confidence: mistralResult.confidence,
        pages_processed: text.length > 0 ? 1 : 0,
        method: (mistralResult.success ? "pdf_page_ocr" : "failed") as "pdf_page_ocr" | "image_ocr" | "failed",
        warnings: mistralResult.warnings,
    };

    console.log("OCR_EXTRACTION_RESULT", {
        success: result.success,
        method: result.method,
        confidence: result.confidence,
        pages_processed: result.pages_processed,
        text_length: result.text.length,
        warnings: result.warnings,
        preview: String(result.text || "").slice(0, 500),
    });

    return result;
}

export async function extractOcrText(filePath: string, mimetype = ""): Promise<string> {
    const result = await extractOcrDetailed(filePath, mimetype);
    return result.text || "";
}


export async function extractWithMistralOcrFallback(
    filePath: string,
    fileName = "",
    mimetype = ""
): Promise<{ text: string; lineItems: ExtractedLineItem[]; warnings: string[]; confidence: number }> {
    const result = await extractInvoiceWithMistralOcr({
        filePath,
        fileName,
        mimetype,
    });

    console.log("MISTRAL_OCR_EXTRACTION_RESULT", {
        success: result.success,
        provider: result.provider,
        confidence: result.confidence,
        warnings: result.warnings,
        textLength: result.rawText?.length || 0,
    });

    return {
        text: result.rawText || "",
        lineItems: convertVisionStructuredToLineItems(result.structured, result.rawText || ""),
        warnings: result.warnings || [],
        confidence: result.confidence || 0,
    };
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


export function extractGenericMaterialInvoiceLineItem(text: string): ExtractedLineItem | null {
    const clean = String(text || "")
        .replace(/,/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const lower = safeLower(clean);

    const materialKeywords = [
        "steel",
        "timber",
        "wood",
        "plywood",
        "aluminium",
        "aluminum",
        "cement",
        "textile",
        "fabric",
        "iron",
        "copper",
        "plastic",
    ];

    const matchedMaterial = materialKeywords.find((keyword) => lower.includes(keyword));
    if (!matchedMaterial) return null;

    // Handles OCR like:
    // "No. 1| STEEL 2MT 55,000.00 MT| 1,10,000.00 CGST..."
    const materialPattern =
        /(steel|timber|wood|plywood|aluminium|aluminum|cement|textile|fabric|iron|copper|plastic)\s+(\d+(?:\.\d+)?)\s*(mt|tonnes?|tons?|kg|kgs|m3|m³|cbm|pcs|pieces|nos?|sqm|m2|m²)\b.{0,80}?(\d{2,}(?:\.\d{1,2})?)?/i;

    const match = clean.match(materialPattern);
    if (!match) return null;

    const material = match[1];
    const quantity = toNumber(match[2]);
    const unit = String(match[3] || "").toUpperCase();

    if (quantity <= 0) return null;

    const amountCandidates = [...clean.matchAll(/\b(\d{3,}(?:\.\d{1,2})?)\b/g)]
        .map((m) => toNumber(m[1]))
        .filter((n) => n > 0);

    const amount =
        amountCandidates.length > 0
            ? amountCandidates[amountCandidates.length - 1]
            : null;

    const currency =
        lower.includes("inr") || clean.includes("₹") || lower.includes("hindustan")
            ? "INR"
            : lower.includes("rm") || lower.includes("myr")
              ? "MYR"
              : null;

    const country =
        currency === "INR"
            ? "IN"
            : currency === "MYR"
              ? "MY"
              : "UNKNOWN";

    return {
        item_name: `${material.toUpperCase()} material invoice`,
        description: `${material.toUpperCase()} purchased goods extracted from OCR text`,
        quantity,
        unit,
        amount,
        currency,
        confidence: 0.78,
        source: "generic_material_text_rules",
        parameters: {
            material: material.toLowerCase(),
            quantity,
            unit,
            country,
            region: country,
            category: "purchased_goods",
            extraction_method: "generic_material_text_rules",
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
        extractGenericMaterialInvoiceLineItem,
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
    let mistralText = "";
    let mistralLineItems: ExtractedLineItem[] = [];
    let mistralConfidence = 0;
    // Hoisted so resolveFinalInvoiceLineItems can inspect all parser outputs
    let ocrResult: any = null;
    let mistralResult: any = null;
    let llmResult: any = null;

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
            ocrResult = await extractOcrDetailed(input.filePath, input.mimetype || "");
            ocrText = ocrResult.text || "";
            if (ocrResult.warnings?.length) {
                warnings.push(...ocrResult.warnings.map((warning: any) => `OCR warning: ${warning}`));
            }
            extractionSteps.push(`ocr_text_length_${ocrText.length}`);
            extractionSteps.push(`ocr_pages_${ocrResult.pages_processed}`);
            extractionSteps.push(`ocr_confidence_${ocrResult.confidence}`);
        } catch (error: any) {
            warnings.push(`OCR extraction failed: ${error?.message || String(error)}`);
            extractionSteps.push("ocr_extraction_failed");
        }
    }


    if (
        process.env.ENABLE_MISTRAL_OCR === "true" &&
        (pdfText + " " + ocrText).trim().length < 300
    ) {
        try {
            extractionSteps.push("mistral_ocr_extraction_started");
            mistralResult = await extractWithMistralOcrFallback(
                input.filePath,
                input.fileName,
                input.mimetype || ""
            );
            mistralText = mistralResult.text;
            mistralLineItems = mistralResult.lineItems;
            mistralConfidence = mistralResult.confidence;
            warnings.push(...mistralResult.warnings);
            extractionSteps.push(`mistral_text_length_${mistralText.length}`);
            extractionSteps.push(`mistral_line_items_${mistralLineItems.length}`);

            // ── Immediate return if Mistral rule-parser found items ───────────────
            const mistralParsedItems =
                (mistralResult as any)?.line_items ||
                (mistralResult as any)?.lineItems ||
                (mistralResult as any)?.items ||
                [];

            if (Array.isArray(mistralParsedItems) && mistralParsedItems.length > 0) {
                warnings.push(
                    `Mistral OCR parsed ${mistralParsedItems.length} material line item(s).`
                );
                extractionSteps.push(`mistral_early_items_${mistralParsedItems.length}`);

                const earlyRawText = cleanText([pdfText, ocrText, mistralText].filter(Boolean).join("\n"));

                return {
                    success: true,
                    method: "mistral_ocr",
                    rawText: mistralResult.text || earlyRawText,
                    textLength: (mistralResult.text || earlyRawText).length,
                    line_items: mistralParsedItems,
                    warnings,
                    needs_review: false,
                    confidence: mistralResult.confidence || 0.82,
                    audit: {
                        fileName: input.fileName,
                        filePath: input.filePath,
                        mimetype: input.mimetype,
                        pdfTextLength: pdfText.length,
                        ocrTextLength: ocrText.length,
                        extraction_steps: [...extractionSteps],
                    },
                };
            }
        } catch (error: any) {
            warnings.push(`Mistral OCR extraction failed: ${error?.message || String(error)}`);
            extractionSteps.push("mistral_ocr_extraction_failed");
        }
    }

    // ── Mistral LLM Structured Extraction ───────────────────────────────────
    // Fires after Mistral OCR when manual rules still found 0 line items.
    if (
        mistralText &&
        (!mistralLineItems || mistralLineItems.length === 0) &&
        process.env.ENABLE_MISTRAL_LLM_EXTRACTION === "true"
    ) {
        try {
            extractionSteps.push("mistral_llm_structured_extraction_started");
            const mistralStructured = await extractStructuredInvoiceWithMistral(
                mistralText,
                input.fileName
            );

            if (mistralStructured.line_items?.length > 0) {
                warnings.push(
                    `Mistral LLM extracted ${mistralStructured.line_items.length} structured line item(s).`
                );
                extractionSteps.push(`mistral_llm_line_items_${mistralStructured.line_items.length}`);
                mistralLineItems = mistralStructured.line_items;
                mistralConfidence = mistralStructured.confidence || 0.78;
            } else {
                extractionSteps.push("mistral_llm_structured_extraction_no_items");
            }
        } catch (error: any) {
            warnings.push(
                `Mistral LLM structured extraction failed: ${
                    (error as any)?.response?.data?.message ||
                    (error as any)?.response?.data?.error?.message ||
                    error?.message ||
                    String(error)
                }`
            );
            extractionSteps.push("mistral_llm_structured_extraction_failed");
        }
    }

    // ── Early return: Mistral (OCR rule-parser or LLM) already found items ───
    // Skip Gemini Vision and Gemini LLM — they are not needed.
    if (mistralLineItems.length > 0) {
        const earlyRawText = cleanText([pdfText, ocrText, mistralText].filter(Boolean).join("\n"));

        extractionSteps.push(`mistral_early_return_items_${mistralLineItems.length}`);

        return {
            success: true,
            method: mistralLineItems.some((i: any) => i.source === "mistral_llm_structured_extraction")
                ? "mistral_ocr_llm"
                : "mistral_ocr",
            rawText: earlyRawText,
            textLength: earlyRawText.length,
            line_items: mistralLineItems,
            warnings,
            needs_review: false,
            confidence: mistralConfidence || 0.78,
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

    if (
        (pdfText + " " + ocrText + " " + mistralText).trim().length < 300 &&
        shouldBlockScannedPdfInFreeMode({
            mimetype: input.mimetype || "",
            fileName: input.fileName || "",
            pdfText,
            ocrText,
        })
    ) {
        return buildScannedPdfFreeModeExtractionResult({
            mimetype: input.mimetype || "",
            fileName: input.fileName || "",
            filePath: input.filePath || "",
            pdfText,
            ocrText,
            extractionSteps,
            warnings,
        });
    }

    if (
        process.env.DISABLE_VISION_EXTRACTION !== "true" &&
        (pdfText + " " + ocrText).trim().length < 300
    ) {
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

    if (
        process.env.DISABLE_VISION_EXTRACTION === "true" &&
        (pdfText + " " + ocrText).trim().length < 300
    ) {
        warnings.push("Vision extraction disabled and OCR/PDF text is below 300 characters.");
    }

    const rawText = cleanText([pdfText, ocrText, mistralText, visionText].filter(Boolean).join("\n"));
    const lineItems = extractStructuredLineItemsFromText(rawText);
    if (!lineItems.length && mistralLineItems.length) {
        lineItems.push(...mistralLineItems);
    }
    if (!lineItems.length && visionLineItems.length) {
        lineItems.push(...visionLineItems);
    }

    // ── Gemini LLM Structured Extraction Fallback ───────────────────────────
    // Disabled if DISABLE_LLM_EXTRACTION=true.
    if (process.env.DISABLE_LLM_EXTRACTION === "true") {
        extractionSteps.push("llm_structured_extraction_disabled");
    } else if (!lineItems.length && rawText.length >= 100) {
        try {
            extractionSteps.push("llm_structured_extraction_started");
            const llmResultLocal = await extractStructuredInvoiceWithLLM(rawText, {
                fileName: input.fileName,
                mimetype: input.mimetype,
            });
            llmResult = llmResultLocal;
            warnings.push(...llmResultLocal.warnings);
            if (llmResultLocal.success && llmResultLocal.line_items.length) {
                lineItems.push(...llmResultLocal.line_items);
                extractionSteps.push(`llm_structured_items_${llmResultLocal.line_items.length}`);
            } else {
                extractionSteps.push("llm_structured_extraction_no_items");
            }
        } catch (error: any) {
            warnings.push(`LLM structured extraction failed: ${error?.message || String(error)}`);
            extractionSteps.push("llm_structured_extraction_failed");
        }
    }

    // ── Permanent Final Extraction Resolver ─────────────────────────────
    // From here onwards, every document must pass through one final resolver.
    // This prevents: OCR text found, but final line_items = [].

    const finalRawText = cleanText(
        [pdfText, ocrText, mistralText, visionText].filter(Boolean).join("\n")
    );

    const auditBase = {
        fileName: input.fileName,
        filePath: input.filePath,
        mimetype: input.mimetype,
        pdfTextLength: pdfText.length,
        ocrTextLength: ocrText.length,
        extraction_steps: extractionSteps,
    };

    // 1. Rule-based text extraction
    const finalLineItems: ExtractedLineItem[] = [];

    const ruleItems = extractStructuredLineItemsFromText(finalRawText);
    if (ruleItems.length > 0) {
        finalLineItems.push(...ruleItems);
        extractionSteps.push(`rule_based_items_${ruleItems.length}`);
    }

    // 2. Existing Mistral parsed items
    if (!finalLineItems.length && mistralLineItems.length > 0) {
        finalLineItems.push(...mistralLineItems);
        extractionSteps.push(`mistral_items_accepted_${mistralLineItems.length}`);
    }

    // 3. Vision items
    if (!finalLineItems.length && visionLineItems.length > 0) {
        finalLineItems.push(...visionLineItems);
        extractionSteps.push(`vision_items_accepted_${visionLineItems.length}`);
    }

    // 4. LLM items
    if (!finalLineItems.length && llmResult?.line_items?.length > 0) {
        finalLineItems.push(...llmResult.line_items);
        extractionSteps.push(`llm_items_accepted_${llmResult.line_items.length}`);
    }

    if (finalLineItems.length > 0) {
        return {
            success: true,
            method: finalLineItems.some((i: any) => i.source === "llm_structured_extraction")
                ? "llm_structured_extraction"
                : mistralText
                  ? "mistral_ocr"
                  : ocrText
                    ? "ocr_text"
                    : "pdf_text",
            rawText: finalRawText,
            textLength: finalRawText.length,
            line_items: finalLineItems,
            warnings,
            needs_review: false,
            confidence: Math.max(
                ...finalLineItems.map((i) => Number(i.confidence || 0.6)),
                mistralConfidence || 0,
                visionConfidence || 0
            ),
            audit: {
                ...auditBase,
                extraction_steps: [...extractionSteps],
            },
        };
    }

    // 5. Mandatory final resolver
    extractionSteps.push("final_line_item_resolver_started");
    warnings.push("Final line item resolver started.");

    const finalResolved = resolveFinalInvoiceLineItems({
        rawText: finalRawText,
        pdfText: pdfText || "",
        ocrText: ocrText || "",
        mistralText: mistralText || "",
        mistralResult: mistralResult || null,
        ocrResult: ocrResult || null,
        visionResult: {
            rawText: visionText,
            line_items: visionLineItems,
        },
        llmResult: llmResult || null,
        warnings,
        audit: {
            ...auditBase,
            extraction_steps: [...extractionSteps],
        },
    });

    extractionSteps.push(`final_resolver_items_${finalResolved.line_items.length}`);

    if (finalResolved.line_items.length > 0) {
        return {
            ...finalResolved,
            success: true,
            needs_review: false,
            audit: {
                ...finalResolved.audit,
                extraction_steps: [
                    ...extractionSteps,
                    ...(finalResolved.audit?.extraction_steps || []).filter(
                        (step: string) => !extractionSteps.includes(step)
                    ),
                ],
            },
        } as any;
    }

    // 6. Direct electricity fallback, in case resolver service was not updated
    extractionSteps.push("electricity_bill_fallback_started");

    const electricityFallbackItems = extractElectricityBillLineItems(finalRawText);

    extractionSteps.push(`electricity_fallback_line_items_${electricityFallbackItems.length}`);

    if (electricityFallbackItems.length > 0) {
        warnings.push(
            `Electricity fallback extracted ${electricityFallbackItems.length} line item(s) from OCR text.`
        );

        return {
            success: true,
            method: "electricity_bill_fallback",
            rawText: finalRawText,
            textLength: finalRawText.length,
            line_items: electricityFallbackItems,
            warnings,
            needs_review: false,
            confidence: 0.86,
            audit: {
                ...auditBase,
                extraction_steps: [...extractionSteps],
            },
        };
    }

    // 7. Direct generic table fallback, in case resolver service was not updated
    extractionSteps.push("generic_ocr_table_fallback_started");

    const genericFallbackItems = extractGenericInvoiceLineItems(finalRawText);

    extractionSteps.push(`generic_fallback_line_items_${genericFallbackItems.length}`);

    if (genericFallbackItems.length > 0) {
        warnings.push(
            `Generic fallback extracted ${genericFallbackItems.length} line item(s) from OCR text.`
        );

        return {
            success: true,
            method: "generic_ocr_table_fallback",
            rawText: finalRawText,
            textLength: finalRawText.length,
            line_items: genericFallbackItems,
            warnings,
            needs_review: false,
            confidence: 0.78,
            audit: {
                ...auditBase,
                extraction_steps: [...extractionSteps],
            },
        };
    }

    // 8. Final failure only after all fallback layers have actually run
    warnings.push(
        "No structured line items extracted after PDF text, OCR, Mistral, Vision, LLM, electricity fallback, generic fallback, and final resolver."
    );

    return {
        success: false,
        method: "final_line_item_resolver",
        rawText: finalRawText,
        textLength: finalRawText.length,
        line_items: [],
        warnings,
        needs_review: true,
        confidence: 0.35,
        error_type: "NO_INVOICE_ITEMS_EXTRACTED",
        message: "No invoice items extracted after all extraction and fallback layers.",
        audit: {
            ...auditBase,
            extraction_steps: [...extractionSteps],
        },
    };
}
