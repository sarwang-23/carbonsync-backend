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

// ─────────────────────────────────────────────────────────────────────────────
// OCR NOISE CLEANING — runs BEFORE category detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cleans OCR-extracted item names by removing surrounding row noise injected
 * when the OCR engine collapses an entire invoice table row into one string.
 *
 *  Input:  "11/06/17 M S TMT Bars 12 mm 38/1129 paying 12/5/17 16/5/17"
 *  Output: "M S TMT Bars 12 mm"
 *
 * Cleaning rules applied in order:
 *  1. Remove standalone dates  (DD/MM/YY, DD-MM-YYYY, YYYY/MM/DD …)
 *  2. Remove invoice / reference numbers  (38/1129, INV-123, SB17Y-02827 …)
 *  3. Remove payment-related keywords and trailing text  (paying, paid, balance …)
 *  4. Collapse multiple spaces
 */
export function normalizeItemName(raw: string): string {
  let s = raw.trim();

  // ── Step 1: Remove date patterns ─────────────────────────────────────────
  // DD/MM/YY(YY) and DD-MM-YY(YY)
  s = s.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, "");
  // YYYY/MM/DD or YYYY-MM-DD
  s = s.replace(/\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g, "");

  // ── Step 2: Remove invoice / reference number patterns ───────────────────
  // Labeled refs: INV-12345, SB17Y-02827, HE/24-25/1632, PO-2024/001
  s = s.replace(
    /\b(?:inv|sb|he|gst|bill|ref|no|sr|so|po|dc|del|note|dn|cn)[\/\-]?[\w\-\/]{2,20}\b/gi,
    ""
  );
  // Pure numeric slash refs: 38/1129, 2024/1234 (2–6 digits on each side)
  s = s.replace(/\b\d{2,6}\/\d{2,6}\b/g, "");
  // Alphanumeric invoice codes (letters then digits, 5-15 chars) like SB17Y02827
  // Preserve known product specs: Fe500, IS2062, TMT, HRC, etc.
  s = s.replace(/\b[A-Z]{1,4}\d{2,}[A-Z0-9]{0,10}\b/g, (match) => {
    const preserve =
      /^(Fe|IS|HR|CR|GP|GI|MS|TMT|HRC|CRC|DRI|HBI|PCI|OPC|PPC|LPG|CNG|PNG|LNG)/i.test(
        match
      );
    return preserve ? match : "";
  });

  // ── Step 3: Remove payment-related keywords (and trailing text on same token) ──
  const PAYMENT_WORDS = [
    "paying",
    "payment",
    "paid",
    "balance",
    "due",
    "outstanding",
    "receipt",
    "invoice",
    "bill no",
    "vide",
    "against",
    "advance",
    "deposit",
    "clearing",
    "settlement",
    "remittance",
    "cheque",
    "neft",
    "rtgs",
    "imps",
    "upi",
    "tds",
    "gst",
  ];
  const paymentPattern = new RegExp(
    `\\b(${PAYMENT_WORDS.join("|")})\\b[^\\n]*`,
    "gi"
  );
  s = s.replace(paymentPattern, "");

  // ── Step 4: Collapse extra whitespace ─────────────────────────────────────
  s = s.replace(/\s+/g, " ").trim();

  // Sanity-check: if cleaning wiped the whole string, return original
  if (!s) {
    console.warn(
      `[normalizeItemName] Full string removed after cleaning — keeping original: "${raw}"`
    );
    return raw.trim();
  }

  if (s !== raw.trim()) {
    console.log(`[normalizeItemName] "${raw.trim()}" → "${s}"`);
  }

  return s;
}

/**
 * Converts raw extracted invoice line items into calculation-ready items.
 * Falls back to text-level quantity/category extraction if structured fields are missing.
 *
 * Pipeline:
 *   OCR raw string
 *     → normalizeItemName()   ← strips dates, invoice refs, payment words
 *     → detectCategoryFromText()
 *     → resolveCategory() override
 *     → emission engine
 */
export function normalizeInvoiceItems(
  rawItems: RawInvoiceItem[],
  vendorName?: string
): NormalizedInvoiceItem[] {
  return rawItems.map((item) => {
    const rawItemName =
      item.item_name ||
      item.description ||
      item.name ||
      JSON.stringify(item);

    // ── OCR Noise Cleaning ──────────────────────────────────────────────────
    // Strip dates, invoice numbers, and payment keywords before anything else.
    // e.g. "11/06/17 M S TMT Bars 12 mm 38/1129 paying 12/5/17" → "M S TMT Bars 12 mm"
    const itemName = normalizeItemName(rawItemName);

    const detectedCategory = detectCategoryFromText(itemName);

    // Prioritize regex-extracted quantity/unit since Mistral often defaults to "1 each"
    const extracted = extractQuantityFromText(itemName);
    const value = extracted.value ?? item.quantity ?? null;
    const unit = extracted.unit ?? item.unit ?? null;

    // Apply override rules to catch extraction-induced misclassification
    const category = resolveCategory(detectedCategory, itemName, unit, vendorName);

    console.log("[normalizeInvoiceItems]", {
      raw_item_name: rawItemName,
      cleaned_item_name: itemName,
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
