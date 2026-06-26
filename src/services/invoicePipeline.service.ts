import { extractInvoiceData } from "./extraction.service.js";
import { normalizeLineItems } from "./lineItemNormalizer.service.js";
import { calculateDynamicCountryEmission } from "./dynamicEmissionFactor.service.js";

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

    const extractionItems = extraction.line_items || [];
    const existingItems = input.existingItems || [];

    const rawItems = extractionItems.length > 0 ? extractionItems : existingItems;
    const normalizedItems = normalizeLineItems(rawItems);

    if (!rawItems.length) {
        return {
            success: false,
            needs_review: true,
            error_type: "NO_INVOICE_ITEMS_EXTRACTED",
            message: "No invoice items extracted from PDF/OCR/Vision or existing extraction flow.",
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
                "No line items were found. Add Vision API key or improve OCR/extraction rules.",
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
