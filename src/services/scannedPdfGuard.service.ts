import { InvoiceExtractionResult } from "./extraction.service.js";

export interface ScannedPdfGuardInput {
    mimetype?: string;
    fileName?: string;
    pdfText?: string;
    ocrText?: string;
}

export function isPdfFile(input: ScannedPdfGuardInput) {
    const type = String(input.mimetype || "").toLowerCase();
    const name = String(input.fileName || "").toLowerCase();

    return type.includes("pdf") || name.endsWith(".pdf");
}

export function shouldBlockScannedPdfInFreeMode(input: ScannedPdfGuardInput) {
    const enabled =
        process.env.FREE_MODE_REJECT_SCANNED_PDF === "true" ||
        process.env.DISABLE_SCANNED_PDF_PROCESSING === "true";

    if (!enabled) return false;
    if (!isPdfFile(input)) return false;

    const pdfLength = String(input.pdfText || "").trim().length;
    const ocrLength = String(input.ocrText || "").trim().length;

    return pdfLength < 50 && ocrLength < 50;
}

export function buildScannedPdfFreeModeExtractionResult(input: ScannedPdfGuardInput & {
    filePath?: string;
    extractionSteps?: string[];
    warnings?: string[];
}): InvoiceExtractionResult {
    const warnings = [
        ...(input.warnings || []),
        "Scanned PDF detected in free mode.",
        "PDF text extraction returned empty text.",
        "OCR returned empty text.",
        "Vision extraction is required for this scanned PDF, but free mode blocks Vision/paid OCR processing.",
    ];

    return {
        success: false,
        method: "scanned_pdf_blocked_free_mode" as any,
        rawText: "",
        textLength: 0,
        line_items: [],
        warnings,
        needs_review: true,
        confidence: 0.1,
        error_type: "SCANNED_PDF_REQUIRES_VISION",
        message:
            "This scanned PDF requires Vision extraction. Please upload a clear JPG/PNG image or enable Gemini Vision credits.",
        audit: {
            fileName: input.fileName || "",
            filePath: input.filePath || "",
            mimetype: input.mimetype || "",
            pdfTextLength: String(input.pdfText || "").trim().length,
            ocrTextLength: String(input.ocrText || "").trim().length,
            extraction_steps: [
                ...(input.extractionSteps || []),
                "scanned_pdf_free_mode_blocked",
            ],
        },
    };
}
