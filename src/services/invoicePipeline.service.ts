import { extractInvoiceData } from "./extraction.service.js";
import { normalizeLineItems } from "./lineItemNormalizer.service.js";
import { calculateDynamicCountryEmission } from "./dynamicEmissionFactor.service.js";
import { resolveLineItemQuantities } from "./quantityResolver.service.js";

export interface UploadedInvoicePipelineInput {
    filePath: string;
    fileName: string;
    mimetype?: string;
    existingItems?: any[];
    reportType?: string;
    reportTypes?: string[];
}

function toNumber(value: any): number {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num : 0;
}

function getResultCo2e(result: any): number {
    return toNumber(result?.result?.co2e ?? result?.co2e ?? 0);
}

function getResultTco2e(result: any): number {
    const direct = toNumber(result?.result?.total_tco2e ?? result?.total_tco2e ?? 0);
    if (direct > 0) return direct;
    return getResultCo2e(result) / 1000;
}

function getWarningText(warning: any): string {
    if (!warning) return "";
    if (typeof warning === "string") return warning;
    if (warning?.message) return String(warning.message);
    return String(warning);
}

function isVisionTemporaryFailure(warnings: any[] = []) {
    const text = warnings.map(getWarningText).join(" ").toLowerCase();

    return (
        text.includes("503") ||
        text.includes("unavailable") ||
        text.includes("high demand") ||
        text.includes("temporarily") ||
        text.includes("overloaded") ||
        text.includes("gemini vision timed out") ||
        text.includes("timed out after") ||
        text.includes("502") ||
        text.includes("504")
    );
}

function isVisionDisabled(warnings: any[] = []) {
    const text = warnings.map(getWarningText).join(" ").toLowerCase();

    return (
        text.includes("gemini_api_key is not configured") ||
        text.includes("vision fallback skipped") ||
        text.includes("disable_vision_extraction=true")
    );
}

function buildNoItemsError(extraction: any) {
    const extractionWarnings = extraction?.warnings || [];
    const temporaryVisionFailure = isVisionTemporaryFailure(extractionWarnings);
    const visionDisabled = isVisionDisabled(extractionWarnings);

    let errorType = "NO_INVOICE_ITEMS_EXTRACTED";
    let message = "No invoice items extracted from PDF/OCR/Vision or existing extraction flow.";
    let primaryWarning = "No line items were found. Add Vision API key or improve OCR/extraction rules.";

    if (temporaryVisionFailure) {
        errorType = "VISION_TEMPORARILY_UNAVAILABLE";
        message =
            "Gemini Vision is temporarily unavailable or timed out. Please retry after some time, or use OCR/provider fallback.";
        primaryWarning =
            "Gemini Vision temporary failure detected. Retry later, switch Gemini model, or use another extraction provider.";
    } else if (visionDisabled) {
        errorType = "VISION_EXTRACTION_DISABLED";
        message =
            "No invoice items extracted. Vision extraction is disabled or GEMINI_API_KEY is missing.";
        primaryWarning =
            "Vision extraction is disabled/missing. Add GEMINI_API_KEY or enable Vision extraction.";
    }

    return {
        errorType,
        message,
        primaryWarning,
        temporaryVisionFailure,
        visionDisabled,
    };
}

/**
 * Final invoice processing pipeline.
 *
 * Flow:
 * 1. Extract invoice data from PDF/OCR/Vision
 * 2. Prefer extracted structured line_items
 * 3. Fall back to existing route extracted items if needed
 * 4. Normalize line items
 * 5. Calculate emissions item-by-item
 * 6. Return totals + extraction audit + calculation results
 */
export async function processUploadedInvoicePipeline(input: UploadedInvoicePipelineInput) {
    const extraction = await extractInvoiceData({
        filePath: input.filePath,
        fileName: input.fileName,
        mimetype: input.mimetype,
    });

    if (
        extraction?.error_type === "SCANNED_PDF_REQUIRES_VISION" ||
        extraction?.method === "scanned_pdf_blocked_free_mode"
    ) {
        return {
            success: false,
            needs_review: true,
            retryable: false,
            error_type: "SCANNED_PDF_REQUIRES_VISION",
            message:
                "This scanned PDF requires Vision extraction. Please upload a clear JPG/PNG image or enable Gemini Vision credits.",
            extraction,
            total_items: 0,
            successful_items: 0,
            failed_items: 0,
            total_kgco2e: 0,
            total_tco2e: 0,
            extracted_items: [],
            normalized_items: [],
            calculation_results: [],
            warnings: extraction?.warnings || [],
        };
    }

    const extractionItems = extraction.line_items || [];
    const existingItems = input.existingItems || [];

    const extractedRawItems = extractionItems.length > 0 ? extractionItems : existingItems;

    const rawItems = resolveLineItemQuantities({
        items: extractedRawItems,
        rawText: extraction.rawText || "",
        fileName: input.fileName,
    });

    const normalizedItems = normalizeLineItems(rawItems);

    if (!rawItems.length) {
        const noItemsError = buildNoItemsError(extraction);

        return {
            success: false,
            needs_review: true,
            retryable: noItemsError.temporaryVisionFailure,
            error_type: noItemsError.errorType,
            message: noItemsError.message,
            extraction,
            total_items: 0,
            successful_items: 0,
            failed_items: 0,
            total_kgco2e: 0,
            total_tco2e: 0,
            extracted_items: [],
            normalized_items: [],
            calculation_results: [],
            warnings: [
                noItemsError.primaryWarning,
                ...(extraction.warnings || []),
            ],
        };
    }

    const calculationResults: any[] = [];

    for (const item of rawItems) {
        try {
            const calculation = await calculateDynamicCountryEmission(
                item,
                extraction.rawText || "",
                input.fileName
            );

            calculationResults.push(calculation);
        } catch (error: any) {
            calculationResults.push({
                success: false,
                needs_review: true,
                error_type: "ITEM_CALCULATION_EXCEPTION",
                message: error?.message || String(error),
                item_name: item?.item_name || item?.description || "Unknown item",
                raw_item: item,
            });
        }
    }

    const successfulItems = calculationResults.filter((r) => r?.success).length;
    const failedItems = calculationResults.length - successfulItems;

    const totalKgco2e = calculationResults
        .filter((r) => r?.success)
        .reduce((sum, r) => sum + getResultCo2e(r), 0);

    const totalTco2e = calculationResults
        .filter((r) => r?.success)
        .reduce((sum, r) => sum + getResultTco2e(r), 0);

    const warnings = [
        ...(extraction.warnings || []),
        ...calculationResults.flatMap((r) => r?.warnings || []),
        ...calculationResults.flatMap((r) => r?.audit_trail?.warnings || []),
    ].filter(Boolean);

    return {
        success: successfulItems > 0,
        needs_review: failedItems > 0 || extraction.needs_review,
        retryable: false,
        message:
            successfulItems > 0
                ? "Invoice uploaded and emissions calculated successfully."
                : "Invoice processed but no items were calculated successfully.",
        report_type: input.reportType || "BRSR",
        report_types: input.reportTypes || ["BRSR", "CBAM"],

        extraction: {
            method: extraction.method,
            confidence: extraction.confidence,
            textLength: extraction.textLength,
            warnings: extraction.warnings,
            needs_review: extraction.needs_review,
            audit: extraction.audit,
        },

        total_items: rawItems.length,
        successful_items: successfulItems,
        failed_items: failedItems,
        total_kgco2e: Number(totalKgco2e.toFixed(6)),
        total_tco2e: Number(totalTco2e.toFixed(6)),

        extracted_items: rawItems,
        normalized_items: normalizedItems,
        calculation_results: calculationResults,
        warnings,
    };
}
