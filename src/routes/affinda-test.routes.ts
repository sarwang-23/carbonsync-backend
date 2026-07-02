import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { uploadSingle } from "../middleware/upload.middleware.js";
import { extractInvoiceWithAffinda } from "../services/AffindaInvoice.service.js";

const router = express.Router();

router.post("/test-affinda", uploadSingle, async (req, res) => {
  let tempFilePath: string | null = null;
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Use form-data with field name: file",
      });
    }

    tempFilePath = path.join(os.tmpdir(), `affinda_${Date.now()}_${file.originalname}`);
    fs.writeFileSync(tempFilePath, file.buffer);

    const result = await extractInvoiceWithAffinda(tempFilePath);

    return res.json({
      success: true,
      provider: result.provider,
      vendorName: result.vendorName,
      invoiceNumber: result.invoiceNumber,
      invoiceDate: result.invoiceDate,
      currency: result.currency,
      total: result.total,
      lineItemCount: result.lineItems.length,
      lineItems: result.lineItems,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Affinda extraction failed",
      error: error.message,
    });
  } finally {
    if (tempFilePath) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
  }
});

export default router;
