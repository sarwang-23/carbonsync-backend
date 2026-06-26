import fs from "fs";
import path from "path";
import os from "os";
import { pathToFileURL } from "url";
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

const OCR_SERVICE_VERSION = "OCR_CHROME_HTML_EMBED_V5_20260627";

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

class NodeCanvasFactory {
    create(width: number, height: number) {
        if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");

        const canvas = createCanvas(width, height);
        const context = canvas.getContext("2d");

        return { canvas, context };
    }

    reset(canvasAndContext: any, width: number, height: number) {
        if (!canvasAndContext?.canvas) throw new Error("Canvas is not specified");
        if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");

        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    }

    destroy(canvasAndContext: any) {
        if (!canvasAndContext?.canvas) return;
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
    }
}

async function createTesseractWorker() {
    const worker: any = await createWorker("eng");

    if (typeof worker.loadLanguage === "function") await worker.loadLanguage("eng");
    if (typeof worker.initialize === "function") await worker.initialize("eng");

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
        if (worker && typeof worker.terminate === "function") await worker.terminate();
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

async function recognizeImagePath(worker: any, imagePath: string, timeoutMs: number) {
    const result: any = await withTimeout(
        worker.recognize(imagePath),
        timeoutMs,
        `Tesseract OCR timed out after ${timeoutMs}ms`
    );

    return {
        text: cleanText(result?.data?.text || ""),
        confidence: Number(result?.data?.confidence || 0),
    };
}

async function recognizePngBuffer(worker: any, pngBuffer: Buffer, timeoutMs: number) {
    const tempPath = writeTempPng(pngBuffer);

    try {
        return await recognizeImagePath(worker, tempPath, timeoutMs);
    } finally {
        try {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {
            // ignore temp cleanup errors
        }
    }
}

async function renderPdfPagesWithPdfJs(
    filePath: string,
    maxPages: number,
    scale: number,
    warnings: string[]
): Promise<Buffer[]> {
    const buffers: Buffer[] = [];
    warnings.push("OCR pdfjs load started");

    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await withTimeout(
        pdfjsLib.getDocument({
            data,
            disableWorker: true,
            verbosity: 0,
            useSystemFonts: true,
            disableFontFace: true,
        } as any).promise,
        getEnvNumber("OCR_PDF_LOAD_TIMEOUT_MS", 10000),
        "PDF load timed out"
    );

    warnings.push(`OCR pdfjs loaded pages: ${pdf.numPages}`);

    const totalPages = Math.min(pdf.numPages, maxPages);
    const canvasFactory = new NodeCanvasFactory();

    for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
        warnings.push(`OCR pdfjs page ${pageNo} get started`);

        const page = await pdf.getPage(pageNo);
        const viewport = page.getViewport({ scale });

        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);

        warnings.push(`OCR pdfjs page ${pageNo} viewport ${width}x${height}`);

        const canvasAndContext = canvasFactory.create(width, height);
        const canvas: any = canvasAndContext.canvas;
        const context: any = canvasAndContext.context;

        context.save();
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.restore();

        try {
            warnings.push(`OCR pdfjs page ${pageNo} render started`);

            await withTimeout(
                page.render({
                    canvasContext: context,
                    viewport,
                    canvasFactory,
                    background: "white",
                } as any).promise,
                getEnvNumber("OCR_RENDER_TIMEOUT_MS", 15000),
                `PDF page ${pageNo} render timed out`
            );

            warnings.push(`OCR pdfjs page ${pageNo} render finished`);

            const processedCanvas = preprocessCanvasForOcr(canvas);
            const imageBuffer = processedCanvas.toBuffer("image/png");

            warnings.push(`OCR pdfjs page ${pageNo} rendered png bytes: ${imageBuffer.length}`);
            buffers.push(imageBuffer);
        } finally {
            canvasFactory.destroy(canvasAndContext);
        }
    }

    return buffers;
}

async function loadPuppeteer(warnings: string[]) {
    try {
        return await import("puppeteer");
    } catch (error1: any) {
        warnings.push(`puppeteer import failed: ${error1?.message || String(error1)}`);
        try {
            return await import("puppeteer-core");
        } catch (error2: any) {
            warnings.push(`puppeteer-core import failed: ${error2?.message || String(error2)}`);
            return null;
        }
    }
}

function findChromeExecutable(puppeteerModule: any) {
    const envPath =
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        process.env.CHROME_EXECUTABLE_PATH ||
        process.env.GOOGLE_CHROME_BIN;

    if (envPath && fs.existsSync(envPath)) return envPath;

    try {
        const p = puppeteerModule?.executablePath?.();
        if (p && fs.existsSync(p)) return p;
    } catch {
        // ignore
    }

    const candidates = [
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
    ];

    return candidates.find((candidate) => fs.existsSync(candidate));
}

async function screenshotPageToPng(page: any, pngPath: string, warnings: string[]) {
    await page.screenshot({
        path: pngPath,
        fullPage: false,
        type: "png",
    });

    const size = fs.existsSync(pngPath) ? fs.statSync(pngPath).size : 0;
    warnings.push(`OCR chrome screenshot bytes: ${size}`);

    return size > 0 ? pngPath : null;
}

async function renderPdfFirstPageWithChrome(filePath: string, warnings: string[]): Promise<string | null> {
    const puppeteerModule: any = await loadPuppeteer(warnings);
    if (!puppeteerModule) return null;

    const executablePath = findChromeExecutable(puppeteerModule);
    warnings.push(`OCR chrome executable: ${executablePath || "puppeteer_default"}`);

    let browser: any = null;
    const pngPath = path.join(
        os.tmpdir(),
        `carbonsync-chrome-pdf-${Date.now()}-${Math.random().toString(16).slice(2)}.png`
    );

    try {
        browser = await puppeteerModule.default.launch({
            executablePath: executablePath || undefined,
            headless: "new",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no-zygote",
                "--disable-extensions",
                "--disable-background-networking",
                "--allow-file-access-from-files",
            ],
        });

        const page = await browser.newPage();

        const width = getEnvNumber("OCR_CHROME_WIDTH", 1200);
        const height = getEnvNumber("OCR_CHROME_HEIGHT", 1600);
        const deviceScaleFactor = getEnvNumber("OCR_CHROME_DEVICE_SCALE", 2);

        await page.setViewport({
            width,
            height,
            deviceScaleFactor,
        });

        const pdfUrl = pathToFileURL(path.resolve(filePath)).href;

        // Direct navigation to a PDF can fail with "Navigating frame was detached" in headless Chrome
        // because Chrome swaps the page into its internal PDF viewer.
        // So we use an HTML wrapper and embed the PDF instead.
        const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: white;
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
  }
  #wrap {
    width: ${width}px;
    height: ${height}px;
    background: white;
    overflow: hidden;
  }
  iframe, embed, object {
    width: ${width}px;
    height: ${height}px;
    border: 0;
    background: white;
  }
</style>
</head>
<body>
  <div id="wrap">
    <iframe src="${pdfUrl}#page=1&zoom=150&toolbar=0&navpanes=0&scrollbar=0"></iframe>
  </div>
</body>
</html>`;

        warnings.push("OCR chrome setContent pdf iframe started");

        await page.setContent(html, {
            waitUntil: "domcontentloaded",
            timeout: getEnvNumber("OCR_CHROME_TIMEOUT_MS", 30000),
        });

        await new Promise((resolve) => setTimeout(resolve, getEnvNumber("OCR_CHROME_WAIT_MS", 4000)));

        let screenshotPath = await screenshotPageToPng(page, pngPath, warnings);
        if (screenshotPath) return screenshotPath;

        // Fallback: use embed instead of iframe.
        warnings.push("OCR chrome iframe screenshot empty, trying embed wrapper");

        const htmlEmbed = html.replace(
            /<iframe[^>]*><\/iframe>/,
            `<embed src="${pdfUrl}#page=1&zoom=150&toolbar=0&navpanes=0&scrollbar=0" type="application/pdf" />`
        );

        await page.setContent(htmlEmbed, {
            waitUntil: "domcontentloaded",
            timeout: getEnvNumber("OCR_CHROME_TIMEOUT_MS", 30000),
        });

        await new Promise((resolve) => setTimeout(resolve, getEnvNumber("OCR_CHROME_WAIT_MS", 4000)));

        screenshotPath = await screenshotPageToPng(page, pngPath, warnings);
        return screenshotPath;
    } catch (error: any) {
        warnings.push(`OCR chrome render failed: ${error?.message || String(error)}`);

        try {
            if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
        } catch {
            // ignore
        }

        return null;
    } finally {
        try {
            if (browser) await browser.close();
        } catch {
            // ignore
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
        const pageTimeoutMs = getEnvNumber("OCR_PAGE_TIMEOUT_MS", 25000);

        worker = await createTesseractWorker();
        warnings.push("OCR tesseract worker created");

        const pageTexts: string[] = [];
        const confidences: number[] = [];
        let pagesProcessed = 0;

        try {
            const imageBuffers = await renderPdfPagesWithPdfJs(filePath, maxPages, scale, warnings);

            for (let i = 0; i < imageBuffers.length; i++) {
                const pageNo = i + 1;
                const result = await recognizePngBuffer(worker, imageBuffers[i], pageTimeoutMs);
                pagesProcessed += 1;

                warnings.push(`OCR pdfjs page ${pageNo} text length: ${result.text.length}`);
                warnings.push(`OCR pdfjs page ${pageNo} confidence: ${result.confidence}`);

                if (result.text) pageTexts.push(result.text);
                if (result.confidence) confidences.push(result.confidence);
            }
        } catch (pdfJsError: any) {
            warnings.push(`OCR pdfjs fatal error: ${pdfJsError?.message || String(pdfJsError)}`);
            warnings.push("OCR trying chrome HTML PDF render fallback");

            const chromePngPath = await renderPdfFirstPageWithChrome(filePath, warnings);

            if (chromePngPath) {
                try {
                    const result = await recognizeImagePath(worker, chromePngPath, pageTimeoutMs);
                    pagesProcessed = 1;

                    warnings.push(`OCR chrome page 1 text length: ${result.text.length}`);
                    warnings.push(`OCR chrome page 1 confidence: ${result.confidence}`);

                    if (result.text) pageTexts.push(result.text);
                    if (result.confidence) confidences.push(result.confidence);
                } finally {
                    try {
                        if (fs.existsSync(chromePngPath)) fs.unlinkSync(chromePngPath);
                    } catch {
                        // ignore
                    }
                }
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
            pages_processed: pagesProcessed,
            method: text ? "pdf_page_ocr" : "failed",
            warnings,
        };
    } catch (error: any) {
        warnings.push(`OCR fatal error: ${error?.message || String(error)}`);

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
        warnings.push("OCR tesseract worker created");

        const result = await recognizeImagePath(
            worker,
            filePath,
            getEnvNumber("OCR_PAGE_TIMEOUT_MS", 25000)
        );

        warnings.push(`OCR image text length: ${result.text.length}`);
        warnings.push(`OCR image confidence: ${result.confidence}`);

        return {
            success: Boolean(result.text),
            text: result.text,
            confidence: Number(result.confidence.toFixed(2)),
            pages_processed: 1,
            method: "image_ocr",
            warnings,
        };
    } catch (error: any) {
        warnings.push(`OCR fatal error: ${error?.message || String(error)}`);

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
