import { extractStructuredInvoiceWithMistral } from "./mistralStructuredExtraction.service.js";
import { extractElectricityBillLineItems } from "./electricityBillFallbackExtractor.service.js";
import { extractGenericInvoiceLineItems } from "./genericInvoiceLineItemExtractor.service.js";

export type UniversalInvoiceItem = {
  item_name: string;
  description?: string;
  quantity?: number;
  unit?: string;
  amount?: number | null;
  currency?: string | null;
  confidence?: number;
  source?: string;
  parameters?: Record<string, any>;
};

function cleanText(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const IGNORED_KEYWORDS = ["gst", "cgst", "sgst", "igst", "vat", "excise duty", "discount", "round off", "tcs", "tds", "insurance", "cess"];
const CONDITIONAL_IGNORE = ["transportation", "packing", "freight"];

function normalizeItems(items: any[], source: string): UniversalInvoiceItem[] {
  return Array.isArray(items)
    ? items
        .filter((item) => item && (item.item_name || item.description))
        .map((item) => ({
          item_name: item.item_name || item.description || "Unknown item",
          description: item.description || item.item_name || "Unknown item",
          quantity: Number(item.quantity || item.parameters?.energy || item.parameters?.energy_kwh || 0),
          unit: item.unit || item.parameters?.energy_unit || "unknown",
          amount: item.amount ?? null,
          currency: item.currency || null,
          category: item.category || "unknown",
          confidence: Number(item.confidence || 0.75),
          source: item.source || source,
          parameters: {
            ...(item.parameters || {}),
            extraction_method: item.parameters?.extraction_method || source,
          },
        }))
        // We let ALL items pass through so that the emission engine can explicitly mark them as "ignored"
        // rather than silently dropping them.
    : [];
}

/**
 * Permanent universal extraction sequence.
 *
 * Priority:
 * 1. Parser items already returned by OCR/parser
 * 2. Electricity fallback
 * 3. Generic regex/table fallback
 * 4. Mistral LLM JSON extraction
 * 5. needs_review
 */
export async function extractUniversalInvoiceLineItems(input: {
  rawText: string;
  fileName?: string;
  parserItems?: any[];
  mistralResult?: any;
  warnings?: string[];
  auditSteps?: string[];
}) {
  const warnings = input.warnings || [];
  const auditSteps = input.auditSteps || [];
  const rawText = cleanText(input.rawText);

  auditSteps.push("universal_invoice_extractor_started");

  const parserItems = [
    ...normalizeItems(input.parserItems || [], "parser_items"),
    ...normalizeItems(input.mistralResult?.line_items || [], "mistral_parser"),
    ...normalizeItems(input.mistralResult?.lineItems || [], "mistral_parser"),
    ...normalizeItems(input.mistralResult?.items || [], "mistral_parser"),
  ];

  if (parserItems.length > 0) {
    auditSteps.push(`universal_parser_items_${parserItems.length}`);
    return {
      success: true,
      method: "universal_parser_items",
      line_items: parserItems,
      warnings,
      confidence: 0.82,
      needs_review: false,
      auditSteps,
    };
  }

  const electricityItems = extractElectricityBillLineItems(rawText);
  if (electricityItems.length > 0) {
    warnings.push(`Universal extractor: electricity fallback extracted ${electricityItems.length} item(s).`);
    auditSteps.push(`universal_electricity_items_${electricityItems.length}`);
    return {
      success: true,
      method: "universal_electricity_fallback",
      line_items: electricityItems,
      warnings,
      confidence: 0.86,
      needs_review: false,
      auditSteps,
    };
  }

  const genericItems = extractGenericInvoiceLineItems(rawText);
  if (genericItems.length > 0) {
    warnings.push(`Universal extractor: generic table fallback extracted ${genericItems.length} item(s).`);
    auditSteps.push(`universal_generic_items_${genericItems.length}`);
    return {
      success: true,
      method: "universal_generic_table_fallback",
      line_items: genericItems,
      warnings,
      confidence: 0.78,
      needs_review: false,
      auditSteps,
    };
  }

  if (process.env.ENABLE_MISTRAL_LLM_EXTRACTION === "true" && rawText.length >= 300) {
    try {
      auditSteps.push("universal_mistral_llm_started");

      const llm = await extractStructuredInvoiceWithMistral(rawText, input.fileName || "invoice.pdf");

      if (llm?.line_items?.length > 0) {
        const items = normalizeItems(llm.line_items, "mistral_llm_structured_extraction");
        warnings.push(`Universal extractor: Mistral LLM extracted ${items.length} item(s).`);
        auditSteps.push(`universal_mistral_llm_items_${items.length}`);

        return {
          success: true,
          method: "universal_mistral_llm",
          line_items: items,
          warnings,
          confidence: llm.confidence || 0.78,
          needs_review: false,
          auditSteps,
        };
      }

      auditSteps.push("universal_mistral_llm_no_items");
    } catch (error: any) {
      warnings.push(`Universal extractor Mistral LLM failed: ${error?.message || String(error)}`);
      auditSteps.push("universal_mistral_llm_failed");
    }
  } else {
    auditSteps.push("universal_mistral_llm_disabled_or_short_text");
  }

  warnings.push("Universal extractor could not confidently extract line items. Marked for review.");
  auditSteps.push("universal_extractor_no_items");

  return {
    success: false,
    method: "universal_extractor_failed",
    line_items: [],
    warnings,
    confidence: 0.35,
    needs_review: true,
    auditSteps,
  };
}