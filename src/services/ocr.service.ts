import fs from "fs";
import path from "path";
import { createCanvas } from "canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker } from "tesseract.js";

export interface OcrResult {
    success: boolean;
    text: string;
    confidence: number;
    pages_processed: number;
    method: "pdf_page_ocr" | "image_ocr" | "failed";
    warnings: string[];
}

function cleanText(text: string) {
    return String(text || "")
        .replace(/\u0000/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

async function createTesseractWorker() {
    const worker: any = await createWorker("eng");

    // Compatibility for different tesseract.js versions.
    if (typeof worker.loadLanguage === "function") {
        await worker.loadLanguage("eng");
    }

    if (typeof worker.initialize === "function") {
        await worker.initialize("eng");
    }

    return worker;
}

async function terminateWorker(worker: any) {
    try {
        if (worker && typeof worker.terminate === "function") {
            await worker.terminate();
        }
    } catch {
        // ignore terminate errors
    }
}

async function recognizeBuffer(worker: any, buffer: Buffer) {
    const result = await worker.recognize(buffer);
    const text = cleanText(result?.data?.text || "");
    const confidence = Number(result?.data?.confidence || 0);

    return {
        text,
        confidence,
    };
}

/**
 * Render PDF pages to images and OCR them.
 * This is useful for scanned PDF invoices where PDF text extraction returns empty/garbage.
 */
export async function extractTextFromPdfWithOcr(
    filePath: string,
    options: {
        maxPages?: number;
        scale?: number;
    } = {}
): Promise<OcrResult> {
    const warnings: string[] = [];
    let worker: any = null;

    try {
        const maxPages = options.maxPages || 3;
        const scale = options.scale || 2;

        const data = new Uint8Array(fs.readFileSync(filePath));
        const pdf = await pdfjsLib.getDocument({ data }).promise;

        worker = await createTesseractWorker();

        const pageTexts: string[] = [];
        const confidences: number[] = [];

        const totalPages = Math.min(pdf.numPages, maxPages);

        for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
            const page = await pdf.getPage(pageNo);
            const viewport = page.getViewport({ scale });

            const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
            const context = canvas.getContext("2d");

            await page.render({
                canvasContext: context as any,
                viewport,
            } as any).promise;

            const imageBuffer = canvas.toBuffer("image/png");
            const result = await recognizeBuffer(worker, imageBuffer);

            if (result.text) {
                pageTexts.push(result.text);
            }

            if (result.confidence) {
                confidences.push(result.confidence);
            }
        }

        const text = cleanText(pageTexts.join("\n"));
        const avgConfidence =
            confidences.length > 0
                ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
                : 0;

        return {
            success: Boolean(text),
            text,
            confidence: Number(avgConfidence.toFixed(2)),
            pages_processed: totalPages,
            method: "pdf_page_ocr",
            warnings,
        };
    } catch (error: any) {
        warnings.push(error?.message || String(error));

        return {
            success: false,
            text: "",
            confidence: 0,
            pages_processed: 0,
            method: "failed",
            warnings,
        };
    } finally {
        await terminateWorker(worker);
    }
}

/**
 * OCR image files directly.
 */
export async function extractTextFromImageWithOcr(filePath: string): Promise<OcrResult> {
    const warnings: string[] = [];
    let worker: any = null;

    try {
        worker = await createTesseractWorker();

        const imageBuffer = fs.readFileSync(filePath);
        const result = await recognizeBuffer(worker, imageBuffer);

        return {
            success: Boolean(result.text),
            text: result.text,
            confidence: Number(result.confidence.toFixed(2)),
            pages_processed: 1,
            method: "image_ocr",
            warnings,
        };
    } catch (error: any) {
        warnings.push(error?.message || String(error));

        return {
            success: false,
            text: "",
            confidence: 0,
            pages_processed: 0,
            method: "failed",
            warnings,
        };
    } finally {
        await terminateWorker(worker);
    }
}

/**
 * Auto OCR for PDF or image.
 */
export async function extractTextWithOcr(
    filePath: string,
    mimetype = "",
    options: {
        maxPages?: number;
        scale?: number;
    } = {}
): Promise<OcrResult> {
    const ext = path.extname(filePath || "").toLowerCase();
    const type = String(mimetype || "").toLowerCase();

    if (type.includes("pdf") || ext === ".pdf") {
        return extractTextFromPdfWithOcr(filePath, options);
    }

    if (
        type.includes("image") ||
        [".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"].includes(ext)
    ) {
        return extractTextFromImageWithOcr(filePath);
    }

    return {
        success: false,
        text: "",
        confidence: 0,
        pages_processed: 0,
        method: "failed",
        warnings: [`Unsupported OCR file type: ${mimetype || ext || "unknown"}`],
    };
}
