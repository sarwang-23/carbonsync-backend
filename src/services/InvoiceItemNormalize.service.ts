import { detectCategoryFromText } from "./CategoryDetection.service.js";
import { extractQuantityFromText } from "./QuantityExtraction.service.js";

type RawInvoiceItem = {
  description?: string;
  name?: string;
  item_name?: string;
  quantity?: number;
  unit?: string;
  amount?: number;
  total?: number;
};

export type NormalizedInvoiceItem = {
  item_name: string;
  category: string;
  value: number;
  unit: string;
};

/**
 * Converts raw extracted invoice line items into calculation-ready items.
 * Falls back to text-level quantity/category extraction if structured fields are missing.
 */
export function normalizeInvoiceItems(
  rawItems: RawInvoiceItem[]
): NormalizedInvoiceItem[] {
  return rawItems.map((item) => {
    const itemName =
      item.item_name ||
      item.description ||
      item.name ||
      JSON.stringify(item);

    const category = detectCategoryFromText(itemName);

    // Try structured quantity first, then extract from text
    const extracted = extractQuantityFromText(itemName);
    const value = item.quantity || extracted.value || null;
    const unit = item.unit || extracted.unit || null;

    return {
      item_name: itemName,
      category,
      value: value ? Number(value) : 0,
      unit: unit || "",
    };
  });
}
