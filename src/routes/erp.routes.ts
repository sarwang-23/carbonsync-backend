import express from "express";
import multer from "multer";
import { extractInvoiceBestEffort } from "../services/InvoiceExtractionOrchestrator.service.js";
import { processMalaysiaInvoiceItems } from "../services/MalaysiaInvoiceEmission.service.js";
import { supabase } from "../lib/supabase.js";
import { extractYearFromInvoice } from "../services/BillYear.service.js";
import { fillNullValues } from "../utils/fillNullValues.js";
import { detectCountryFromText } from "../services/CountryDetection.service.js";
import { normalizeInvoiceItems } from "../services/InvoiceItemNormalize.service.js";
import { processInvoiceEmissions } from "../services/InvoiceEmission.service.js";
import { parseFallbackLineItems } from "../services/FallbackLineItemParser.service.js";

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

    const invoiceYear = extractYearFromInvoice(invoice);

    // ── Country detection ───────────────────────────────────────────────────
    const fullText = [
      invoice.vendorName,
      invoice.vendorAddress,
      invoice.currency,
      JSON.stringify(invoice.lineItems || []),
      JSON.stringify(invoice.rawResponse || {}),
    ]
      .filter(Boolean)
      .join(" ");

    const detectedCountry = detectCountryFromText(fullText, file.originalname || "");

    if (!detectedCountry) {
      return res.status(400).json({
        success: false,
        message: "Country could not be detected. Please review invoice country/region.",
        type: "COUNTRY_DETECTION_FAILED",
      });
    }

    // ── Fallback line item parser ──────────────────────────────────────────
    let items = invoice.lineItems || [];

    if (!items.length || items.length === 1) {
      const fallbackItems = parseFallbackLineItems(fullText);

      if (fallbackItems.length > items.length) {
        items = fallbackItems.map((fi) => ({
          name: fi.item_name,
          description: fi.category,
          quantity: fi.value,
          unit: fi.unit,
          amount: null,
          currency: detectedCountry.currency,
        })) as any[];
      }
    }

    // Still empty?
    if (items.length === 0) {
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

    console.log("COUNTRY_DETECTED", {
      region: detectedCountry.region,
      country_name: detectedCountry.country_name,
      currency: detectedCountry.currency,
    });

    // ── Malaysia: keep existing pipeline intact ─────────────────────
    if (detectedCountry.region === "MY") {
      const emissionResult = await processMalaysiaInvoiceItems({
        extractionId,
        fileName: file.originalname,
        items,
        invoiceYear,
      });

      const sourceEngine = "climatiq";
      const preferredSource = "Climatiq";

      const responseBody = {
        success: true,
        message: `${detectedCountry.country_name} invoice processed`,
        file_name: file.originalname,
        country: detectedCountry,
        extraction: {
          provider: extraction.provider,
          score: extraction.score,
          vendor_name: invoice.vendorName,
          invoice_number: invoice.invoiceNumber,
          invoice_date:
            invoice.invoiceDate ||
            (invoiceYear ? String(invoiceYear) : "not_available"),
          invoice_year: invoiceYear,
          currency: detectedCountry.currency || invoice.currency || "not_available",
          total: invoice.total,
          item_count: items.length,
          attempts: extraction.attempts,
        },
        emission: {
          success: emissionResult.success,
          source_engine: sourceEngine,
          preferred_source: preferredSource,
          total_items: emissionResult.total_items,
          calculated_count: emissionResult.calculated_count,
          review_count: emissionResult.review_count,
          failed_count: emissionResult.failed_count,
          total_co2e: Number(Number(emissionResult.total_co2e || 0).toFixed(6)),
          total_co2e_unit: emissionResult.total_co2e_unit || "kg",
          results: emissionResult.results,
        },
      };

      return res.status(200).json(fillNullValues(responseBody));
    }

    // ── DE / US / GB / FR / AU: generic emission pipeline ──────────────────
    const normalizedItems = normalizeInvoiceItems(items);

    function extractElectricityKwhFromText(text: string): number | null {
      const normalized = text.replace(/\s+/g, " ");

      const netBilledMatch = normalized.match(
        /net\s+billed\s+unit\s*[:\-]?\s*([\d,.]+)\s*kwh/i
      );

      if (netBilledMatch) {
        return Number(netBilledMatch[1].replace(/,/g, ""));
      }

      const assessedMatch = normalized.match(
        /assessed\s+unit\s*[:\-]?\s*([\d,.]+)/i
      );

      if (assessedMatch) {
        return Number(assessedMatch[1].replace(/,/g, ""));
      }

      return null;
    }

    const electricityUnits = extractElectricityKwhFromText(fullText);

    for (const item of normalizedItems) {
      if (electricityUnits && item.category === "electricity") {
        item.value = electricityUnits;
        item.unit = "kWh";
      }
    }

    const emissionResult = await processInvoiceEmissions({
      region: detectedCountry.region,
      country_name: detectedCountry.country_name,
      invoice_year: invoiceYear,
      items: normalizedItems,
    });

    let sourceEngine = "official_factor_db";
    let preferredSource: string | undefined = undefined;

    if (detectedCountry.region === "DE") {
      sourceEngine = "climatiq";
      preferredSource = "UBA";
    }

    const responseBody = {
      success: true,
      message: `${detectedCountry.country_name} invoice processed`,
      file_name: file.originalname,
      country: detectedCountry,
      extraction: {
        provider: extraction.provider,
        score: extraction.score,
        vendor_name: invoice.vendorName,
        invoice_number: invoice.invoiceNumber,
        invoice_date:
          invoice.invoiceDate ||
          (invoiceYear ? String(invoiceYear) : "not_available"),
        invoice_year: invoiceYear,
        currency: detectedCountry.currency || invoice.currency || "not_available",
        total: invoice.total,
        item_count: items.length,
        attempts: extraction.attempts,
      },
      emission: {
        success: emissionResult.success,
        source_engine: sourceEngine,
        ...(preferredSource ? { preferred_source: preferredSource } : {}),
        total_items: emissionResult.total_items,
        calculated_count: emissionResult.calculated_count,
        review_count: emissionResult.review_count,
        failed_count: emissionResult.failed_count,
        total_co2e: Number(Number(emissionResult.total_co2e || 0).toFixed(6)),
        total_co2e_unit: emissionResult.total_co2e_unit || "kg",
        results: emissionResult.results,
      },
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
