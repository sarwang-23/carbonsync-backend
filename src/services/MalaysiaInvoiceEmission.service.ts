import type { NormalizedInvoiceItem } from "../types/invoice.types.js";
import { supabase } from "../lib/supabase.js";
import { findEmissionMappingForItem } from "./myEmissionMapping.service.js";
import { convertToTargetUnit } from "./UnitConversion.service.js";
import { calculateEmissionWithClimatiq } from "./myClimatiq.service.js";
import { findBestClimatiqFactorForBill } from "./ClimatiqFactorSearch.service.js";

export async function processMalaysiaInvoiceItems(params: {
  extractionId?: string;
  fileName?: string;
  items: NormalizedInvoiceItem[];
  invoiceYear?: number | null;
}) {
  const { extractionId, fileName, items, invoiceYear } = params;

  const results = [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index];

    const mappingResult = await findEmissionMappingForItem(item, "MY");

    if (!mappingResult.matched || !mappingResult.mapping) {
      await saveReviewItem({
        extractionId,
        fileName,
        item,
        reason: mappingResult.reason,
        suggestedCategory: mappingResult.suggestedCategory
      });

      await saveInvoiceItem({
        extractionId,
        index,
        item,
        status: "needs_review",
        category: mappingResult.suggestedCategory,
        errorMessage: mappingResult.reason
      });

      results.push({
        line_index: index,
        item,
        status: "needs_review",
        matched: false,
        category: mappingResult.suggestedCategory,
        reason: mappingResult.reason,
        confidence: mappingResult.confidence,
        emission: null
      });

      continue;
    }

    const mapping = mappingResult.mapping;

    if (!item.quantity || !item.unit) {
      await saveReviewItem({
        extractionId,
        fileName,
        item,
        reason: "Quantity or unit missing",
        suggestedCategory: mapping.category
      });

      await saveInvoiceItem({
        extractionId,
        index,
        item,
        status: "needs_review",
        category: mapping.category,
        mappingId: mapping.id,
        activityId: mapping.activity_id,
        parameterName: mapping.parameter_name,
        parameterUnit: mapping.parameter_unit,
        errorMessage: "Quantity or unit missing"
      });

      results.push({
        line_index: index,
        item,
        status: "needs_review",
        matched: true,
        category: mapping.category,
        reason: "Quantity or unit missing",
        emission: null
      });

      continue;
    }

    let converted;

    try {
      converted = convertToTargetUnit(
        item.quantity,
        item.unit,
        mapping.parameter_unit
      );
    } catch (error: any) {
      await saveReviewItem({
        extractionId,
        fileName,
        item,
        reason: error.message,
        suggestedCategory: mapping.category
      });

      await saveInvoiceItem({
        extractionId,
        index,
        item,
        status: "unit_conversion_failed",
        category: mapping.category,
        mappingId: mapping.id,
        activityId: mapping.activity_id,
        parameterName: mapping.parameter_name,
        parameterUnit: mapping.parameter_unit,
        errorMessage: error.message
      });

      results.push({
        line_index: index,
        item,
        status: "unit_conversion_failed",
        matched: true,
        category: mapping.category,
        activity_id: mapping.activity_id,
        reason: error.message,
        emission: null
      });

      continue;
    }

    let selectedFactor: any = null;

    try {
      selectedFactor = await findBestClimatiqFactorForBill({
        region: "MY",
        category: mapping.category,
        activityId: mapping.activity_id,
        parameterName: mapping.parameter_name,
        parameterUnit: mapping.parameter_unit,
        billYear: invoiceYear || null,
      });
    } catch (error: any) {
      console.warn("Factor search failed, falling back to activity_id:", error.message);
    }

    const climatiqResult = await calculateEmissionWithClimatiq({
      activityId: mapping.activity_id,
      parameterName: mapping.parameter_name,
      value: converted.value,
      unit: converted.unit,
      region: "MY",
      dataVersion: mapping.data_version,
      factorId: selectedFactor?.factorId || null,
    });

    if (!climatiqResult.success) {
      await saveInvoiceItem({
        extractionId,
        index,
        item,
        status: "climatiq_failed",
        category: mapping.category,
        mappingId: mapping.id,
        activityId: mapping.activity_id,
        parameterName: mapping.parameter_name,
        parameterUnit: mapping.parameter_unit,
        converted,
        climatiqRequest: climatiqResult.requestBody,
        climatiqResponse: climatiqResult.error,
        errorMessage: "Climatiq calculation failed"
      });

      results.push({
        line_index: index,
        item,
        status: "climatiq_failed",
        matched: true,
        category: mapping.category,
        activity_id: mapping.activity_id,
        converted,
        climatiq_error: climatiqResult.error,
        climatiq_request: climatiqResult.requestBody,
        emission: null
      });

      continue;
    }

    const co2e =
      climatiqResult.data?.co2e ||
      climatiqResult.data?.co2e_total ||
      null;

    const co2eUnit =
      climatiqResult.data?.co2e_unit ||
      "kg";

    const effectiveFactor =
      converted?.value && converted.value > 0
        ? Number((Number(co2e) / converted.value).toFixed(6))
        : null;

    await saveInvoiceItem({
      extractionId,
      index,
      item,
      status: "calculated",
      category: mapping.category,
      mappingId: mapping.id,
      activityId: mapping.activity_id,
      parameterName: mapping.parameter_name,
      parameterUnit: mapping.parameter_unit,
      converted,
      co2e,
      co2eUnit,
      climatiqRequest: climatiqResult.requestBody,
      climatiqResponse: climatiqResult.data
    });

    results.push({
      line_index: index,
      item,
      status: "calculated",
      matched: true,
      confidence: mappingResult.confidence,
      category: mapping.category,
      activity_id: mapping.activity_id,
      parameter_name: mapping.parameter_name,
      selected_factor: selectedFactor
        ? {
            factorId: selectedFactor.factorId,
            factorYear: selectedFactor.factorYear || invoiceYear || "not_available",
            source: selectedFactor.source || "not_available",
            sourceDataset: selectedFactor.sourceDataset || "not_available",
            sourceLcaActivity: selectedFactor.sourceLcaActivity || "not_available",
            factor: effectiveFactor,
            factorUnit: `${co2eUnit}CO2e/${converted.unit}`,
            fromCache: selectedFactor.fromCache ?? false,
            rawFactor: selectedFactor.rawFactor,
          }
        : {
            factorId: "not_available",
            factorYear: invoiceYear || "not_available",
            source: "not_available",
            sourceDataset: "not_available",
            sourceLcaActivity: "not_available",
            factor: effectiveFactor,
            factorUnit: `${co2eUnit}CO2e/${converted.unit}`,
            fromCache: false,
          },
      effective_factor: {
        value: effectiveFactor,
        unit: `${co2eUnit}CO2e/${converted.unit}`,
        calculation: "co2e / activity_value",
      },
      converted,
      climatiq_request: climatiqResult.requestBody,
      emission: climatiqResult.data,
      co2e,
      co2e_unit: co2eUnit
    });
  }

  const calculatedItems = results.filter((r) => r.status === "calculated");
  const reviewItems = results.filter((r) => r.status === "needs_review");
  const failedItems = results.filter(
    (r) =>
      r.status === "unit_conversion_failed" ||
      r.status === "climatiq_failed"
  );

  const totalCo2e = calculatedItems.reduce((sum, item: any) => {
    return sum + Number(item.co2e || 0);
  }, 0);

  return {
    success: true,
    region: "MY",
    total_items: items.length,
    calculated_count: calculatedItems.length,
    review_count: reviewItems.length,
    failed_count: failedItems.length,
    total_co2e: totalCo2e,
    total_co2e_unit: "kg",
    results
  };
}

async function saveReviewItem(params: {
  extractionId?: string;
  fileName?: string;
  item: NormalizedInvoiceItem;
  reason: string;
  suggestedCategory?: string;
}) {
  const { extractionId, fileName, item, reason, suggestedCategory } = params;

  await supabase.from("invoice_item_reviews").insert({
    extraction_id: extractionId || null,
    file_name: fileName || null,
    region: "MY",
    raw_item_name: item.name,
    normalized_item_name: item.name?.toLowerCase(),
    extracted_quantity: item.quantity || null,
    extracted_unit: item.unit || null,
    extracted_amount: item.amount || null,
    currency: item.currency || "MYR",
    suggested_category: suggestedCategory || "unknown_review",
    suggested_reason: reason,
    status: "pending"
  });
}

async function saveInvoiceItem(params: {
  extractionId?: string;
  index: number;
  item: NormalizedInvoiceItem;
  status: string;
  category?: string;
  mappingId?: string;
  activityId?: string;
  parameterName?: string;
  parameterUnit?: string;
  converted?: any;
  co2e?: number | null;
  co2eUnit?: string | null;
  climatiqRequest?: any;
  climatiqResponse?: any;
  errorMessage?: string;
}) {
  const {
    extractionId,
    index,
    item,
    status,
    category,
    mappingId,
    activityId,
    parameterName,
    parameterUnit,
    converted,
    co2e,
    co2eUnit,
    climatiqRequest,
    climatiqResponse,
    errorMessage
  } = params;

  await supabase.from("invoice_items").insert({
    extraction_id: extractionId || null,
    line_index: index,
    raw_name: item.name,
    normalized_name: item.name?.toLowerCase(),
    description: item.description || null,
    quantity: item.quantity || null,
    unit: item.unit || null,
    unit_price: item.unitPrice || null,
    amount: item.amount || null,
    currency: item.currency || "MYR",
    category: category || null,
    mapping_status: status,
    mapping_id: mappingId || null,
    activity_id: activityId || null,
    parameter_name: parameterName || null,
    parameter_unit: parameterUnit || null,
    converted_value: converted?.value || null,
    converted_unit: converted?.unit || null,
    co2e: co2e || null,
    co2e_unit: co2eUnit || null,
    climatiq_request: climatiqRequest || null,
    climatiq_response: climatiqResponse || null,
    error_message: errorMessage || null
  });
}
