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
  description?: string;
};

// Units that are ONLY used for gas/thermal energy — never for electricity billing
const GAS_ONLY_UNITS = new Set(["gj", "mj", "gj/year", "mj/year", "gigajoule", "megajoule"]);

// Electricity-only units — if these appear, electricity is correct
const ELECTRICITY_ONLY_UNITS = new Set(["kwh", "mwh", "gwh", "kwhr"]);

// Gas vendor/utility keywords that override a wrong 'electricity' detection
const GAS_VENDOR_KEYWORDS = [
  "gas network",
  "gas networks",
  "gas company",
  "gas supply",
  "gas distribution",
  "gas distributor",
  "gas utility",
  "gas services",
  "natural gas",
  "pipeline gas",
  "jemena gas",
  "agn gas",
  "evoenergy gas",
  "aussie gas",
  "australian gas",
];

/**
 * Post-detection category override:
 * Fixes cases where extraction embeds misleading words in item_name
 * (e.g. "Aussie Gas Network Pty Ltd Electricity Consumption").
 *
 * Rules (in priority order):
 * 1. Gas-only unit (GJ/MJ) → force natural_gas
 * 2. Gas vendor keyword in name → force natural_gas (only if currently electricity)
 * 3. Electricity-only unit (kWh/MWh) → force electricity
 */
function resolveCategory(
  detected: string,
  itemName: string,
  unit: string | null | undefined,
  vendorName?: string
): string {
  const u = (unit || "").toLowerCase().trim();
  const name = itemName.toLowerCase();
  const vendor = (vendorName || "").toLowerCase();

  // Rule 1: gas-only unit overrides anything
  if (GAS_ONLY_UNITS.has(u)) {
    if (detected === "electricity") {
      console.log(
        `[CategoryOverride] unit="${u}" is gas-only → overriding "electricity" → "natural_gas" | item: ${itemName}`
      );
    }
    return "natural_gas";
  }

  // Rule 2: gas keyword in vendor name OR item name overrides electricity
  const hasGasKeyword = (name.includes("gas") && !name.includes("gasoline")) || 
                        (vendor.includes("gas") && !vendor.includes("gasoline"));
                        
  if (hasGasKeyword && detected === "electricity") {
    console.log(
      `[CategoryOverride] gas keyword found in vendor/item → overriding "electricity" → "natural_gas" | item: ${itemName}, vendor: ${vendor}`
    );
    return "natural_gas";
  }
  
  if (hasGasKeyword && detected === "unknown") {
    return "natural_gas";
  }

  // Rule 3: electricity-only unit → lock in electricity, UNLESS it is heating/gas which also uses kWh
  if (ELECTRICITY_ONLY_UNITS.has(u) && detected !== "district_heating" && detected !== "natural_gas") {
    return "electricity";
  }

  // Rule 4: gas vendor/utility keyword override (only when wrongly detected as electricity)
  if (detected === "electricity") {
    const hasGasVendor = GAS_VENDOR_KEYWORDS.some((kw) => name.includes(kw) || vendor.includes(kw));
    if (hasGasVendor) {
      console.log(
        `[CategoryOverride] gas vendor keyword found → overriding "electricity" → "natural_gas" | item: ${itemName}`
      );
      return "natural_gas";
    }
  }

  return detected;
}

/**
 * Converts raw extracted invoice line items into calculation-ready items.
 * Falls back to text-level quantity/category extraction if structured fields are missing.
 */
export function normalizeInvoiceItems(
  rawItems: RawInvoiceItem[],
  vendorName?: string
): NormalizedInvoiceItem[] {
  return rawItems.map((item) => {
    const itemName =
      item.item_name ||
      item.description ||
      item.name ||
      JSON.stringify(item);

    const detectedCategory = detectCategoryFromText(itemName);

    // Try structured quantity first, then extract from text
    const extracted = extractQuantityFromText(itemName);
    const value = item.quantity || extracted.value || null;
    const unit = item.unit || extracted.unit || null;

    // Apply override rules to catch extraction-induced misclassification
    const category = resolveCategory(detectedCategory, itemName, unit, vendorName);

    console.log("[normalizeInvoiceItems]", {
      item_name: itemName,
      detected_category: detectedCategory,
      final_category: category,
      value,
      unit,
    });

    return {
      item_name: itemName,
      category,
      value: value ? Number(value) : 0,
      unit: unit || "",
      description: item.description,
    };
  });
}
