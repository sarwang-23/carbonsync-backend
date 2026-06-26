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

const OCR_SERVICE_VERSION = "OCR_TEMP_FILE_PATH_V2_20260627";

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

async function recognizeWithMultipleInputs(worker: any, pngBuffer: Buffer, timeoutMs: number, warnings: string[]) {
    const tempPath = writeTempPng(pngBuffer);

    try {
        // Try 1: file path. This is usually the most stable on Node/Render.
        try {
            const result: any = await withTimeout(
                worker.recognize(tempPath),
                timeoutMs,
                `Tesseract OCR timed out after ${timeoutMs}ms using tempPath`
            );

            return {
                text: cleanText(result?.data?.text || ""),
                confidence: Number(result?.data?.confidence || 0),
                input_mode: "tempPath",
            };
        } catch (error: any) {
            warnings.push(`OCR tempPath mode failed: ${error?.message || String(error)}`);
        }

        // Try 2: absolute file URL. Some Node/image loaders accept this when path fails.
        try {
            const fileUrl = `file://${tempPath.replace(/\\/g, "/")}`;
            const result: any = await withTimeout(
                worker.recognize(fileUrl),
                timeoutMs,
                `Tesseract OCR timed out after ${timeoutMs}ms using fileUrl`
            );

            return {
                text: cleanText(result?.data?.text || ""),
                confidence: Number(result?.data?.confidence || 0),
                input_mode: "fileUrl",
            };
        } catch (error: any) {
            warnings.push(`OCR fileUrl mode failed: ${error?.message || String(error)}`);
        }

        // Try 3: data URL. This avoids path handling problems on Render.
        try {
            const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
            const result: any = await withTimeout(
                worker.recognize(dataUrl),
                timeoutMs,
                `Tesseract OCR timed out after ${timeoutMs}ms using dataUrl`
            );

            return {
                text: cleanText(result?.data?.text || ""),
                confidence: Number(result?.data?.confidence || 0),
                input_mode: "dataUrl",
            };
        } catch (error: any) {
            warnings.push(`OCR dataUrl mode failed: ${error?.message || String(error)}`);
        }

        return {
            text: "",
            confidence: 0,
            input_mode: "all_failed",
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
    const warnings: string[] = [`${OCR_SERVICE_VERSION}`];
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

            warnings.push(`OCR page ${pageNo} rendered png bytes: ${imageBuffer.length}`);

            const result = await recognizeWithMultipleInputs(worker, imageBuffer, pageTimeoutMs, warnings);
            warnings.push(`OCR page ${pageNo} input mode: ${result.input_mode}`);

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
    const warnings: string[] = [`${OCR_SERVICE_VERSION}`];
    let worker: any = null;

    try {
        worker = await createTesseractWorker();

        const imageBuffer = fs.readFileSync(filePath);
        const result = await recognizeWithMultipleInputs(
            worker,
            imageBuffer,
            getEnvNumber("OCR_PAGE_TIMEOUT_MS", 20000),
            warnings
        );

        return {
            success: Boolean(result.text),
            text: result.text,
            confidence: Number(result.confidence.toFixed(2)),
            pages_processed: 1,
            method: "image_ocr",
            warnings: [...warnings, `OCR image input mode: ${result.input_mode}`],
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
            warnings: [`${OCR_SERVICE_VERSION}`, "DISABLE_OCR_EXTRACTION=true. OCR skipped."],
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
        warnings: [`${OCR_SERVICE_VERSION}`, `Unsupported OCR file type: ${mimetype || ext || "unknown"}`],
    };
}
