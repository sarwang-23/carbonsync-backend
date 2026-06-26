import fs from "fs";
import path from "path";
import os from "os";
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
        .replace(/[^\S\r\n]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function getEnvNumber(name: string, defaultValue: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
): Promise<T> {
    let timer: NodeJS.Timeout | null = null;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function createTesseractWorker() {
    const worker: any = await createWorker("eng");

    if (typeof worker.loadLanguage === "function") {
        await worker.loadLanguage("eng");
    }

    if (typeof worker.initialize === "function") {
        await worker.initialize("eng");
    }

    if (typeof worker.setParameters === "function") {
        await worker.setParameters({
            tessedit_pageseg_mode: "6",
            preserve_interword_spaces: "1",
            user_defined_dpi: "220",
        });
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

function preprocessCanvasForOcr(canvas: any) {
    const context = canvas.getContext("2d");
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        let enhanced = (gray - 128) * 1.35 + 128;
        enhanced = enhanced > 185 ? 255 : enhanced < 95 ? 0 : enhanced;

        data[i] = enhanced;
        data[i + 1] = enhanced;
        data[i + 2] = enhanced;
    }

    context.putImageData(imageData, 0, 0);
    return canvas;
}

function writeTempPng(buffer: Buffer) {
    const filePath = path.join(
        os.tmpdir(),
        `carbonsync-ocr-${Date.now()}-${Math.random().toString(16).slice(2)}.png`
    );

    fs.writeFileSync(filePath, buffer);
    return filePath;
}

/**
 * Tesseract.js on Node can throw "Image or Canvas expected" when Buffer is passed directly.
 * To avoid that, this writes the PNG buffer to a temp file and recognizes the file path.
 */
async function recognizePngBuffer(worker: any, buffer: Buffer, timeoutMs: number) {
    const tempPath = writeTempPng(buffer);

    try {
        const result: any = await withTimeout(
            worker.recognize(tempPath),
            timeoutMs,
            `Tesseract OCR timed out after ${timeoutMs}ms`
        );

        const text = cleanText(result?.data?.text || "");
        const confidence = Number(result?.data?.confidence || 0);

        return {
            text,
            confidence,
        };
    } finally {
        try {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {
            // ignore temp cleanup errors
        }
    }
}

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
        const maxPages = options.maxPages || getEnvNumber("OCR_MAX_PAGES", 1);
        const scale = options.scale || getEnvNumber("OCR_SCALE", 2);
        const pageTimeoutMs = getEnvNumber("OCR_PAGE_TIMEOUT_MS", 20000);

        const data = new Uint8Array(fs.readFileSync(filePath));
        const pdf = await withTimeout(
            pdfjsLib.getDocument({
                data,
                disableWorker: true,
                verbosity: 0,
            } as any).promise,
            getEnvNumber("OCR_PDF_LOAD_TIMEOUT_MS", 10000),
            "PDF load timed out"
        );

        worker = await createTesseractWorker();

        const pageTexts: string[] = [];
        const confidences: number[] = [];

        const totalPages = Math.min(pdf.numPages, maxPages);

        for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
            const page = await pdf.getPage(pageNo);
            const viewport = page.getViewport({ scale });

            const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
            const context = canvas.getContext("2d");

            context.fillStyle = "white";
            context.fillRect(0, 0, canvas.width, canvas.height);

            await withTimeout(
                page.render({
                    canvasContext: context as any,
                    viewport,
                } as any).promise,
                getEnvNumber("OCR_RENDER_TIMEOUT_MS", 15000),
                `PDF page ${pageNo} render timed out`
            );

            const processedCanvas = preprocessCanvasForOcr(canvas);
            const imageBuffer = processedCanvas.toBuffer("image/png");

            const result = await recognizePngBuffer(worker, imageBuffer, pageTimeoutMs);

            if (result.text) {
                pageTexts.push(result.text);
            } else {
                warnings.push(`OCR returned empty text for page ${pageNo}`);
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

export async function extractTextFromImageWithOcr(filePath: string): Promise<OcrResult> {
    const warnings: string[] = [];
    let worker: any = null;

    try {
        worker = await createTesseractWorker();

        // Use file path directly, not Buffer, to avoid "Image or Canvas expected".
        const result: any = await withTimeout(
            worker.recognize(filePath),
            getEnvNumber("OCR_PAGE_TIMEOUT_MS", 20000),
            `Tesseract OCR timed out after ${getEnvNumber("OCR_PAGE_TIMEOUT_MS", 20000)}ms`
        );

        const text = cleanText(result?.data?.text || "");
        const confidence = Number(result?.data?.confidence || 0);

        return {
            success: Boolean(text),
            text,
            confidence: Number(confidence.toFixed(2)),
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

    if (process.env.DISABLE_OCR_EXTRACTION === "true") {
        return {
            success: false,
            text: "",
            confidence: 0,
            pages_processed: 0,
            method: "failed",
            warnings: ["DISABLE_OCR_EXTRACTION=true. OCR skipped."],
        };
    }

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
