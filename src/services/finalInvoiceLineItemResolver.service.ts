import { extractElectricityBillLineItems } from "./electricityBillFallbackExtractor.service.js";
import { extractGenericInvoiceLineItems } from "./genericInvoiceLineItemExtractor.service.js";

type ResolveInput = {
    rawText?: string;
    pdfText?: string;
    ocrText?: string;
    mistralText?: string;

    // Any parser/OCR outputs you already have:
    mistralResult?: any;
    ocrResult?: any;
    visionResult?: any;
    llmResult?: any;

    warnings?: string[];
    audit?: any;
};

function asArray(value: any): any[] {
    return Array.isArray(value) ? value : [];
}

function normalizeParserItems(items: any[], source = "parser") {
    return asArray(items)
        .filter((item) => item && (item.item_name || item.description))
        .map((item) => ({
            item_name: item.item_name || item.description || "Unknown item",
            description: item.description || item.item_name || "Unknown item",
            quantity: Number(item.quantity || item.original_quantity || item.parameters?.energy || item.parameters?.energy_kwh || 0),
            unit: item.unit || item.original_unit || item.parameters?.energy_unit || "unknown",
            amount: item.amount ?? null,
            currency: item.currency || null,
            confidence: Number(item.confidence || 0.75),
            source: item.source || source,
            parameters: {
                ...(item.parameters || {}),
                extraction_method: item.parameters?.extraction_method || source,
            },
        }))
        .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);
}

function pickText(input: ResolveInput) {
    return (
        input.mistralText ||
        input.ocrText ||
        input.pdfText ||
        input.rawText ||
        input.mistralResult?.rawText ||
        input.ocrResult?.rawText ||
        input.visionResult?.rawText ||
        ""
    );
}

/**
 * Permanent final line-item resolver.
 *
 * This prevents the common bug:
 * "Mistral OCR parsed X line items" but final line_items = [].
 *
 * Priority:
 * 1. Any line_items already returned by Mistral/manual/LLM parser
 * 2. Electricity fallback for TNB / power bills
 * 3. Generic OCR table fallback for material invoices
 * 4. return [] only if everything fails
 */
export function resolveFinalInvoiceLineItems(input: ResolveInput) {
    const warnings = input.warnings || [];
    const audit = input.audit || {};
    const rawText = pickText(input);

    const parserCandidates = [
        ...normalizeParserItems(input.mistralResult?.line_items, "mistral_ocr_parser"),
        ...normalizeParserItems(input.mistralResult?.lineItems, "mistral_ocr_parser"),
        ...normalizeParserItems(input.mistralResult?.items, "mistral_ocr_parser"),
        ...normalizeParserItems(input.ocrResult?.line_items, "ocr_parser"),
        ...normalizeParserItems(input.visionResult?.line_items, "vision_parser"),
        ...normalizeParserItems(input.llmResult?.line_items, "llm_parser"),
    ];

    if (parserCandidates.length > 0) {
        warnings.push(`Final resolver accepted ${parserCandidates.length} parser line item(s).`);

        return {
            success: true,
            method: "parser_items_resolver",
            rawText,
            textLength: rawText.length,
            line_items: parserCandidates,
            warnings,
            needs_review: false,
            confidence: 0.82,
            audit: {
                ...audit,
                extraction_steps: [
                    ...(audit.extraction_steps || []),
                    "final_line_item_resolver_started",
                    `final_resolver_parser_items_${parserCandidates.length}`,
                ],
            },
        };
    }

    const electricityItems = extractElectricityBillLineItems(rawText);
    if (electricityItems.length > 0) {
        warnings.push(`Electricity fallback extracted ${electricityItems.length} line item(s) from OCR text.`);

        return {
            success: true,
            method: "electricity_bill_fallback",
            rawText,
            textLength: rawText.length,
            line_items: electricityItems,
            warnings,
            needs_review: false,
            confidence: 0.86,
            audit: {
                ...audit,
                extraction_steps: [
                    ...(audit.extraction_steps || []),
                    "final_line_item_resolver_started",
                    "electricity_bill_fallback_started",
                    `electricity_fallback_line_items_${electricityItems.length}`,
                ],
            },
        };
    }

    const genericItems = extractGenericInvoiceLineItems(rawText);
    if (genericItems.length > 0) {
        warnings.push(`Generic fallback extracted ${genericItems.length} line item(s) from OCR text.`);

        return {
            success: true,
            method: "generic_ocr_table_fallback",
            rawText,
            textLength: rawText.length,
            line_items: genericItems,
            warnings,
            needs_review: false,
            confidence: 0.78,
            audit: {
                ...audit,
                extraction_steps: [
                    ...(audit.extraction_steps || []),
                    "final_line_item_resolver_started",
                    "generic_ocr_table_fallback_started",
                    `generic_fallback_line_items_${genericItems.length}`,
                ],
            },
        };
    }

    return {
        success: false,
        method: "final_line_item_resolver",
        rawText,
        textLength: rawText.length,
        line_items: [],
        warnings,
        needs_review: true,
        confidence: 0.35,
        audit: {
            ...audit,
            extraction_steps: [
                ...(audit.extraction_steps || []),
                "final_line_item_resolver_started",
                "final_line_item_resolver_no_items",
            ],
        },
    };
}
