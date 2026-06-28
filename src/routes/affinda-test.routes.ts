import express from "express";
import multer from "multer";
import { extractInvoiceWithAffinda } from "../services/AffindaInvoice.service.js";

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

router.post("/test-affinda", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Use form-data key: file",
      });
    }

    const result = await extractInvoiceWithAffinda(file.path);

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
  }
});

export default router;
