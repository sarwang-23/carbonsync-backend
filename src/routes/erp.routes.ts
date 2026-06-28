import express from "express";
import multer from "multer";
import { extractInvoiceBestEffort } from "../services/InvoiceExtractionOrchestrator.service.js";
import { processMalaysiaInvoiceItems } from "../services/MalaysiaInvoiceEmission.service.js";
import { supabase } from "../lib/supabase.js";
import { extractYearFromInvoice } from "../services/BillYear.service.js";
import { fillNullValues } from "../utils/fillNullValues.js";

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const extraction = await extractInvoiceBestEffort(file.path);
    const invoice = extraction.result;

    const { data: extractionRow, error: extractionSaveError } = await supabase
      .from("invoice_extractions")
      .insert({
        file_name: file.originalname,
        region: "MY",
        extraction_provider: extraction.provider,
        extraction_status: extraction.status,
        vendor_name: invoice.vendorName || null,
        invoice_number: invoice.invoiceNumber || null,
        invoice_date: invoice.invoiceDate || null,
        currency: invoice.currency || "MYR",
        subtotal: invoice.subtotal || null,
        tax: invoice.tax || null,
        total: invoice.total || null,
        raw_response: invoice.rawResponse || null,
        normalized_response: invoice || null
      })
      .select()
      .single();

    if (extractionSaveError) {
      console.error("Extraction save error:", extractionSaveError.message);
    }

    const extractionId = extractionRow?.id;

    if (!invoice.lineItems || invoice.lineItems.length === 0) {
      return res.status(200).json({
        success: true,
        status: "extraction_empty",
        message: "Invoice uploaded, but no line items were extracted",
        extraction_provider: extraction.provider,
        extraction_score: extraction.score,
        attempts: extraction.attempts,
        next_action: "Check Affinda field mapping or Mistral OCR fallback"
      });
    }

    const invoiceYear = extractYearFromInvoice(invoice);

    const emissionResult = await processMalaysiaInvoiceItems({
      extractionId,
      fileName: file.originalname,
      items: invoice.lineItems,
      invoiceYear,
    });

    const responseBody = {
      success: true,
      message: "Malaysia invoice processed",
      file_name: file.originalname,
      extraction: {
        provider: extraction.provider,
        score: extraction.score,
        vendor_name: invoice.vendorName,
        invoice_number: invoice.invoiceNumber,
        invoice_date: invoice.invoiceDate || (invoiceYear ? String(invoiceYear) : "not_available"),
        invoice_year: invoiceYear,
        currency: invoice.currency,
        total: invoice.total,
        item_count: invoice.lineItems.length,
        attempts: extraction.attempts
      },
      emission: emissionResult
    };

    return res.status(200).json(fillNullValues(responseBody));
  } catch (error: any) {
    console.error("ERP upload failed:", error);

    return res.status(500).json({
      success: false,
      message: "Invoice processing failed",
      error: error.message
    });
  }
});

router.post("/review/approve", async (req, res) => {
  try {
    const {
      review_id,
      category,
      keyword,
      activity_id,
      parameter_name,
      parameter_unit
    } = req.body;

    if (!review_id || !category || !keyword || !activity_id || !parameter_name || !parameter_unit) {
      return res.status(400).json({
        success: false,
        message: "review_id, category, keyword, activity_id, parameter_name and parameter_unit are required"
      });
    }

    const { data: mapping } = await supabase
      .from("emission_factor_mappings")
      .select("*")
      .eq("region", "MY")
      .eq("category", category)
      .eq("activity_id", activity_id)
      .eq("is_active", true)
      .maybeSingle();

    if (mapping) {
      const existingKeywords = mapping.keywords || [];
      const newKeywords = Array.from(new Set([...existingKeywords, keyword]));

      await supabase
        .from("emission_factor_mappings")
        .update({
          keywords: newKeywords,
          updated_at: new Date().toISOString()
        })
        .eq("id", mapping.id);
    } else {
      await supabase.from("emission_factor_mappings").insert({
        region: "MY",
        country_name: "Malaysia",
        category,
        keywords: [keyword],
        activity_id,
        parameter_name,
        parameter_unit,
        data_version: "^6",
        priority: 50,
        confidence_score: 0.85,
        is_active: true,
        notes: "Created from review approval"
      });
    }

    await supabase
      .from("invoice_item_reviews")
      .update({
        status: "approved",
        approved_category: category,
        approved_activity_id: activity_id,
        approved_parameter_name: parameter_name,
        approved_parameter_unit: parameter_unit,
        reviewed_by: "admin",
        reviewed_at: new Date().toISOString()
      })
      .eq("id", review_id);

    return res.json({
      success: true,
      message: "Review approved and mapping updated"
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Review approval failed",
      error: error.message
    });
  }
});

export default router;
