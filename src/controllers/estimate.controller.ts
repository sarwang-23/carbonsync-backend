import * as fs from "fs";
import type { Request, Response } from "express";
import { processDocumentService } from "../services/estimate.service.js";

export async function estimateController(req: Request, res: Response) {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No document file uploaded" });
            return;
        }

        const extractedData = await processDocumentService(req.file.path);
        
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Failed to delete temp file", err);
        });
        
        res.status(200).json(extractedData);
    
    } catch (error: any) {
        console.error("Affinda API Error:", error);
        res.status(500).json({ error: error.message || "Failed to parse document" });
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
    }
}