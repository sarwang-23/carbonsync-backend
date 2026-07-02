import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { uploadSingle } from "../middleware/upload.middleware.js";
import { extractInvoiceBestEffort } from "../services/InvoiceExtractionOrchestrator.service.js";
import { processMalaysiaInvoiceItems } from "../services/MalaysiaInvoiceEmission.service.js";
import { supabase } from "../lib/supabase.js";
import { extractYearFromInvoice } from "../services/BillYear.service.js";
import { fillNullValues } from "../utils/fillNullValues.js";
import { detectCountryFromText } from "../services/CountryDetection.service.js";
import { normalizeInvoiceItems } from "../services/InvoiceItemNormalize.service.js";
import { processInvoiceEmissions } from "../services/InvoiceEmission.service.js";
import { parseFallbackLineItems } from "../services/FallbackLineItemParser.service.js";
import { parseRailwayTicketItem } from "../services/RailwayTicketParser.service.js";
import { parseFlightTicketItem, calculateRouteDistance } from "../services/FlightTicketParser.service.js";
import { smartRailLookup } from "../services/IndiaRailwayRouteDB.js";

const router = express.Router();

router.post("/upload", uploadSingle, async (req, res) => {
  let tempFilePath: string | null = null;
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Use form-data with field name: file"
      });
    }

    // Write memory buffer to a temp file so downstream services can use file.path
    tempFilePath = path.join(os.tmpdir(), `carbonsync_${Date.now()}_${file.originalname}`);
    fs.writeFileSync(tempFilePath, file.buffer);

    const extraction = await extractInvoiceBestEffort(tempFilePath);
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
    let normalizedItems = normalizeInvoiceItems(items, invoice.vendorName);

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

    const lowerText = fullText.toLowerCase();

    // ── Flight parser runs FIRST (priority over railway) ─────────────────────
    const isFlightTicket =
      lowerText.includes("flight booking") ||
      lowerText.includes("indigo") ||
      lowerText.includes("air india") ||
      lowerText.includes("vistara") ||
      lowerText.includes("akasa") ||
      lowerText.includes("spicejet") ||
      (lowerText.includes("pnr") && lowerText.includes("airport")) ||
      (lowerText.includes("e-ticket") && lowerText.includes("airport"));

    if (isFlightTicket) {
      // ── Priority 1: Mistral extracted flight fields ─────────────────────
      const mistralOriginAirport = (invoice as any).origin_airport as string | null;
      const mistralDestAirport = (invoice as any).destination_airport as string | null;
      const mistralPassengers = typeof (invoice as any).passenger_count === "number"
        ? (invoice as any).passenger_count
        : 1;

      if (mistralOriginAirport && mistralDestAirport) {
        const routeResult = await calculateRouteDistance({
          fromAirport: mistralOriginAirport,
          toAirport: mistralDestAirport
        });

        if (routeResult.success && routeResult.distanceKm > 0) {
          const totalDistanceKm = routeResult.distanceKm;
          const totalPassengerKm = totalDistanceKm * mistralPassengers;

          normalizedItems = [{
            item_name: `Flight travel ${mistralOriginAirport}-${mistralDestAirport} ${totalDistanceKm} km`,
            description: `Flight passenger travel ${totalDistanceKm} km × ${mistralPassengers} passenger(s)`,
            category: "flight",
            value: totalPassengerKm,
            unit: "passenger-km",
            metadata: {
              routes: [{
                fromAirport: mistralOriginAirport,
                toAirport: mistralDestAirport,
                distanceKm: routeResult.distanceKm,
                fromCity: routeResult.from.city,
                toCity: routeResult.to.city,
              }],
              passengerCount: mistralPassengers,
              totalDistanceKm,
              calculation_method: "mistral_extracted_airports_haversine",
            },
          } as any];
        } else {
          // Fallback to text parser if coordinate lookup fails
          const flightItem = await parseFlightTicketItem(fullText, file.originalname);
          if (flightItem) normalizedItems = [flightItem as any];
        }
      } else {
        // Priority 2: Text-based parser
        const flightItem = await parseFlightTicketItem(fullText, file.originalname);
        if (flightItem) {
          normalizedItems = [flightItem as any];
        }
      }
    } else {
      // ── Railway parser: priority-based distance resolution ────────────────
      const isRailwayTicket =
        lowerText.includes("indian railways") ||
        lowerText.includes("irctc") ||
        lowerText.includes("train no") ||
        lowerText.includes("electronic reservation slip") ||
        lowerText.includes("passenger details");

      if (isRailwayTicket) {
        const RAILWAY_EF = 0.007976;

        // ── Priority 1: Mistral extracted distance directly ─────────────────
        const mistralDistanceKm = typeof (invoice as any).distance_km === "number"
          ? (invoice as any).distance_km
          : null;
        const mistralOrigin = (invoice as any).origin_station as string | null;
        const mistralDest = (invoice as any).destination_station as string | null;
        const mistralPassengers = typeof (invoice as any).passenger_count === "number"
          ? (invoice as any).passenger_count
          : 1;

        if (mistralDistanceKm && mistralDistanceKm > 0) {
          const passengerKm = mistralDistanceKm * mistralPassengers;
          normalizedItems = [{
            item_name: `Indian Railways travel ${mistralOrigin || ""} → ${mistralDest || ""} ${mistralDistanceKm} km`,
            category: "railway",
            value: passengerKm,
            unit: "passenger-km",
            metadata: { distance_km: mistralDistanceKm, passenger_count: mistralPassengers, distance_source: "mistral_extracted", origin: mistralOrigin, destination: mistralDest },
          } as any];

        // ── Priority 2: Mistral extracted station codes → DB lookup ─────────
        } else if (mistralOrigin && mistralDest) {
          const dbResult = smartRailLookup(mistralOrigin, mistralDest);
          if (dbResult) {
            const passengerKm = dbResult.distanceKm * mistralPassengers;
            normalizedItems = [{
              item_name: `Indian Railways travel ${mistralOrigin} → ${mistralDest} ${dbResult.distanceKm} km`,
              category: "railway",
              value: passengerKm,
              unit: "passenger-km",
              metadata: { distance_km: dbResult.distanceKm, passenger_count: mistralPassengers, distance_source: dbResult.source, origin: mistralOrigin, destination: mistralDest },
            } as any];
          } else {
            // Station found but not in DB → send to railway parser for text scan
            const railwayItem = parseRailwayTicketItem(fullText);
            if (railwayItem) normalizedItems = [railwayItem as any];
          }

        // ── Priority 3: Text-based parser + filename route fallback ─────────
        } else {
          // Try filename route: "dli to mfp.pdf" or "NDLS-HWH.pdf"
          const fnMatch = file.originalname?.match(/([A-Za-z]{2,5})\s*(?:to|[-_])\s*([A-Za-z]{2,5})/i);
          let railwayItem = parseRailwayTicketItem(fullText);

          if (!railwayItem || railwayItem.category === "railway_review") {
            if (fnMatch) {
              const fnFrom = fnMatch[1].toUpperCase();
              const fnTo = fnMatch[2].toUpperCase();
              const fnResult = smartRailLookup(fnFrom, fnTo);
              if (fnResult) {
                railwayItem = {
                  name: `Indian Railways travel ${fnFrom} → ${fnTo} ${fnResult.distanceKm} km`,
                  description: `Indian Railways passenger travel ${fnResult.distanceKm} km (from filename)`,
                  quantity: fnResult.distanceKm,
                  unit: "passenger-km",
                  category: "railway",
                  metadata: { distance_km: fnResult.distanceKm, passenger_count: 1, distance_source: "filename_route", origin: fnFrom, destination: fnTo },
                };
              }
            }
          }

          if (railwayItem) normalizedItems = [railwayItem as any];
        }
      }
    }

    const emissionResult = await processInvoiceEmissions({
      region: detectedCountry.region,
      country_name: detectedCountry.country_name,
      invoice_year: invoiceYear,
      invoice_text: fullText,   // full raw text for AU state detection
      items: normalizedItems,
    });

    let sourceEngine = "official_factor_db";
    let preferredSource: string | undefined = undefined;

    if (detectedCountry.region === "IN") {
      sourceEngine = "india_hybrid";
      preferredSource = "India Fixed EF";
    }

    if (detectedCountry.region === "DE") {
      sourceEngine = "climatiq";
      preferredSource = "UBA";
    }

    const total_co2e_val = Number(Number(emissionResult.total_co2e || 0).toFixed(6));
    const uniqueCategories = Array.from(new Set(emissionResult.results.map((r: any) => r.category).filter(Boolean)));

    const responseBody = {
      success: true,
      message: `${detectedCountry.country_name} invoice processed`,
      total_co2e: total_co2e_val,
      total_tco2e: Number((total_co2e_val / 1000).toFixed(6)),
      extracted_items: items.length,
      categories: uniqueCategories.length > 0 ? uniqueCategories.join(", ") : "—",
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
      error: error.message,
      stack: error.stack
    });
  } finally {
    // Always clean up temp file regardless of success or failure
    if (tempFilePath) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
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
