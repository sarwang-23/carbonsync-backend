import { extractInvoiceWithGemini } from "./GeminiVisionInvoice.service.js";
import { extractInvoiceWithAffinda } from "./AffindaInvoice.service.js";
import { extractInvoiceWithMistral } from "./MistralInvoice.service.js";
import type { NormalizedInvoice } from "../types/invoice.types.js";

function scoreExtractionQuality(invoice: NormalizedInvoice) {
  let score = 0;

  if (invoice.vendorName) score += 20;
  if (invoice.invoiceNumber) score += 15;
  if (invoice.invoiceDate) score += 10;
  if (invoice.total) score += 15;
  if (invoice.lineItems?.length > 0) score += 25;

  const items = invoice.lineItems || [];

  const goodItems = items.filter((item) => {
    return item.name && (item.quantity || item.amount);
  }).length;

  if (items.length > 0) {
    score += Math.min(15, (goodItems / items.length) * 15);
  }

  return Math.round(score);
}

function mergeExtractedLineItems(primaryItems: any[], secondaryItems: any[]) {
  if (!primaryItems?.length) return secondaryItems || [];
  if (!secondaryItems?.length) return primaryItems || [];

  return primaryItems.map((primary, index) => {
    const secondary = secondaryItems[index] || {};

    return {
      name: primary.name || secondary.name,
      description: primary.description || secondary.description,
      quantity: primary.quantity || secondary.quantity,
      unit: primary.unit || secondary.unit,
      unitPrice: primary.unitPrice || secondary.unitPrice,
      amount: primary.amount || secondary.amount,
      currency: primary.currency || secondary.currency || "MYR"
    };
  });
}

export async function extractInvoiceBestEffort(filePath: string) {
  const attempts: any[] = [];

  // Step 1: Ultra-fast Gemini Vision extraction (takes ~1-2 seconds)
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiResult = await extractInvoiceWithGemini(filePath);
      const geminiScore = scoreExtractionQuality(geminiResult);

      attempts.push({
        provider: "gemini",
        status: "completed",
        score: geminiScore,
      });

      if (geminiScore >= 50) {
        return {
          provider: "gemini",
          status: "completed",
          score: geminiScore,
          result: geminiResult,
          attempts,
        };
      }
    } catch (err: any) {
      console.warn("[Gemini Vision] Fast extraction failed, falling back to Affinda/Mistral:", err.message);
      attempts.push({
        provider: "gemini",
        status: "failed",
        score: 0,
        error: err.message,
      });
    }
  }

  // Run Affinda and Mistral in parallel for fast response times
  const [affindaPromise, mistralPromise] = [
    (async () => {
      try {
        const result = await extractInvoiceWithAffinda(filePath);
        const score = scoreExtractionQuality(result);
        return { provider: "affinda", status: "completed", score, result };
      } catch (error: any) {
        const status = error?.response?.status || error?.status;
        if (status === 403 || error.message?.includes("403")) {
          console.warn("[Affinda] 403 Unauthorized — API key expired or plan limit reached.");
        } else {
          console.error("[Affinda] Extraction failed:", error.message);
        }
        return { provider: "affinda", status: "failed", score: 0, error: error.message };
      }
    })(),
    (async () => {
      try {
        const result = await extractInvoiceWithMistral(filePath);
        const score = scoreExtractionQuality(result);
        return { provider: "mistral", status: "completed", score, result };
      } catch (error: any) {
        console.error("[Mistral] Extraction failed:", error.message);
        return { provider: "mistral", status: "failed", score: 0, error: error.message };
      }
    })(),
  ];

  const [affindaRes, mistralRes] = await Promise.all([affindaPromise, mistralPromise]);

  attempts.push({
    provider: "affinda",
    status: affindaRes.status,
    score: affindaRes.score,
    ...(affindaRes.error ? { error: affindaRes.error } : {}),
  });

  attempts.push({
    provider: "mistral",
    status: mistralRes.status,
    score: mistralRes.score,
    ...(mistralRes.error ? { error: mistralRes.error } : {}),
  });

  const affindaResult = affindaRes.result || null;
  const affindaScore = affindaRes.score || 0;
  const mistralResult = mistralRes.result || null;
  const mistralScore = mistralRes.score || 0;

  // If both succeeded, merge them for best accuracy
  if (affindaResult && mistralResult) {
    const merged: NormalizedInvoice = {
      provider: "affinda+mistral",
      vendorName: affindaResult.vendorName || mistralResult.vendorName,
      invoiceNumber: affindaResult.invoiceNumber || mistralResult.invoiceNumber,
      invoiceDate: affindaResult.invoiceDate || mistralResult.invoiceDate,
      currency: affindaResult.currency || mistralResult.currency || "MYR",
      subtotal: affindaResult.subtotal || mistralResult.subtotal,
      tax: affindaResult.tax || mistralResult.tax,
      total: affindaResult.total || mistralResult.total,
      lineItems: mergeExtractedLineItems(
        affindaResult.lineItems || [],
        mistralResult.lineItems || []
      ),
      rawResponse: {
        affinda: affindaResult.rawResponse,
        mistral: mistralResult.rawResponse
      },
      origin_station: affindaResult.origin_station || mistralResult.origin_station,
      destination_station: affindaResult.destination_station || mistralResult.destination_station,
      distance_km: affindaResult.distance_km ?? mistralResult.distance_km,
      passenger_count: affindaResult.passenger_count ?? mistralResult.passenger_count,
      train_number: affindaResult.train_number || mistralResult.train_number,
      train_name: affindaResult.train_name || mistralResult.train_name,
      origin_airport: affindaResult.origin_airport || mistralResult.origin_airport,
      destination_airport: affindaResult.destination_airport || mistralResult.destination_airport,
      airline: affindaResult.airline || mistralResult.airline,
      flight_number: affindaResult.flight_number || mistralResult.flight_number,
      travel_class: affindaResult.travel_class || mistralResult.travel_class,
    };

    const mergedScore = scoreExtractionQuality(merged);

    return {
      provider: "affinda+mistral",
      status: "completed",
      score: mergedScore,
      result: merged,
      attempts
    };
  }

  // If only Mistral succeeded with good quality
  if (mistralResult && mistralScore >= 40) {
    return {
      provider: "mistral",
      status: "completed",
      score: mistralScore,
      result: mistralResult,
      attempts
    };
  }

  // If only Affinda succeeded
  if (affindaResult && affindaScore >= 40) {
    return {
      provider: "affinda",
      status: "completed",
      score: affindaScore,
      result: affindaResult,
      attempts
    };
  }

  if (mistralResult) {
    return {
      provider: "mistral",
      status: "partial",
      score: mistralScore,
      result: mistralResult,
      attempts
    };
  }

  if (affindaResult) {
    return {
      provider: "affinda",
      status: "partial",
      score: affindaScore,
      result: affindaResult,
      attempts
    };
  }

  return {
    provider: "none",
    status: "failed",
    score: 0,
    result: {
      provider: "none",
      lineItems: []
    },
    attempts
  };
}
