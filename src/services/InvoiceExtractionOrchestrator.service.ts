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

  let affindaResult: NormalizedInvoice | null = null;
  let affindaScore = 0;

  try {
    affindaResult = await extractInvoiceWithAffinda(filePath);
    affindaScore = scoreExtractionQuality(affindaResult);

    attempts.push({
      provider: "affinda",
      status: "completed",
      score: affindaScore
    });

    if (affindaScore >= 80) {
      return {
        provider: "affinda",
        status: "completed",
        score: affindaScore,
        result: affindaResult,
        attempts
      };
    }
  } catch (error: any) {
    attempts.push({
      provider: "affinda",
      status: "failed",
      error: error.message
    });
  }

  let mistralResult: NormalizedInvoice | null = null;
  let mistralScore = 0;

  try {
    mistralResult = await extractInvoiceWithMistral(filePath);
    mistralScore = scoreExtractionQuality(mistralResult);

    attempts.push({
      provider: "mistral",
      status: "completed",
      score: mistralScore
    });
  } catch (error: any) {
    attempts.push({
      provider: "mistral",
      status: "failed",
      error: error.message
    });
  }

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
      }
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

  if (mistralResult && mistralScore >= 50) {
    return {
      provider: "mistral",
      status: "completed",
      score: mistralScore,
      result: mistralResult,
      attempts
    };
  }

  if (affindaResult && affindaScore >= 40) {
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
