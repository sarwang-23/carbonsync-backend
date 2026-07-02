import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import os from 'os';
// @ts-ignore
import pdfPoppler from 'pdf-poppler';

export async function preprocessPdfForOcr(pdfPath: string): Promise<string> {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-preprocess-'));
    
    const opts = {
        format: 'jpeg',
        out_dir: outputDir,
        out_prefix: 'page',
        page: null, // all pages
        scale: 2048 // High res / 300-400 DPI equivalent
    };

    try {
        await pdfPoppler.convert(pdfPath, opts);
        
        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg')).sort();
        if (files.length === 0) {
            throw new Error('No images generated from PDF');
        }

        // Just enhance the first page for now if it's a single page invoice, 
        // or we can just process the first page since most invoices are 1 page.
        const firstPagePath = path.join(outputDir, files[0]);
        const enhancedImagePath = path.join(outputDir, 'enhanced.jpeg');

        await sharp(firstPagePath)
            .grayscale()
            .normalize() // contrast increase
            .linear(1.2, -10) // slight contrast boost
            .sharpen()
            .toFile(enhancedImagePath);

        const base64 = fs.readFileSync(enhancedImagePath).toString('base64');
        
        // Clean up
        fs.rmSync(outputDir, { recursive: true, force: true });
        
        return base64;
    } catch (e) {
        fs.rmSync(outputDir, { recursive: true, force: true });
        throw e;
    }
}
