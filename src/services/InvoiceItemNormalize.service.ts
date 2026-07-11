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
  amount?: number;
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
  // EXCEPT when the item explicitly states it is electricity (e.g. buying electricity from British Gas)
  const hasGasKeyword = (name.includes("gas") && !name.includes("gasoline")) || 
                        (vendor.includes("gas") && !vendor.includes("gasoline"));
                        
  const isExplicitlyElectricity = name.includes("electricity") || name.includes("power");

  if (hasGasKeyword && detected === "electricity" && !isExplicitlyElectricity) {
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
  if (detected === "electricity" && !isExplicitlyElectricity) {
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
export function normalizeItemName(raw: string, vendorName?: string): string {
  let s = raw.trim();

  // ── Step 0: Condense long technical specification strings ──────────────────
  // Triggered when the raw string looks like a full-blown product specification
  // e.g. "1100 Volts Grade, PVC/XLPE Insulated, Armoured/UnArmoured. Overall
  //        PVC /FRLS Sheathed, Aluminium/Copper ... 'AVOCAB' Brand."
  // → returns a short canonical name like "Aluminium HT Cable"
  if (s.length > 80) {
    const spec = s.toLowerCase();

    // ── Electrical cable / wire ───────────────────────────────────────────
    const isCable =
      /\b(conductor|cable|wire|xlpe|pvc|frls|armoured|armored|submersible|ht\s*cable|lv\s*cable|mv\s*cable|kv\s*grade|insulated|sheathed)\b/.test(spec);
    if (isCable) {
      const isAluminium = /\b(aluminium|aluminum|alu\b)/.test(spec);
      const isCopper    = /\b(copper|cu\b)/.test(spec);
      const isHT        = /\b(11\s*kv|33\s*kv|ht\s*cable|high\s*tension)/.test(spec);
      const isSubmersible = /submersible/.test(spec);
      const base = isAluminium ? "Aluminium" : isCopper ? "Copper" : "";
      const suffix = isSubmersible ? "Submersible Cable" : isHT ? "HT Cable" : "Cable";
      return [base, suffix].filter(Boolean).join(" ");
    }

    // ── Pipes / fittings ─────────────────────────────────────────────────
    if (/\b(pipe|fitting|flanges?|valve|hdpe|ppr|upvc|cpvc|gi\s*pipe|ms\s*pipe)\b/.test(spec)) {
      if (/\b(ms|mild\s*steel|galvanized|gi\b)/.test(spec)) return "MS GI Pipe";
      if (/\bhdpe\b/.test(spec)) return "HDPE Pipe";
      if (/\bupvc\b/.test(spec)) return "uPVC Pipe";
      return "Industrial Pipe";
    }

    // ── Steel sections ───────────────────────────────────────────────────
    if (/\b(tmt|deformed\s*bar|reinforcement\s*bar|rebar|ms\s*bar|channel|angle|beam|h-?beam|i-?beam)\b/.test(spec)) {
      if (/\btmt\b/.test(spec)) return "MS TMT Bar";
      if (/\b(angle|l-?section)\b/.test(spec)) return "MS Angle";
      if (/\b(channel|c-?section)\b/.test(spec)) return "MS Channel";
      if (/\b(beam|h-?section|i-?section)\b/.test(spec)) return "MS Beam";
      return "Steel Section";
    }

    // ── Timber / boards ──────────────────────────────────────────────────
    if (/\b(plywood|ply|blockboard|mdf|particleboard|timber|wood)\b/.test(spec)) {
      if (/\bplywood\b/.test(spec)) return "Commercial Plywood";
      if (/\bmdf\b/.test(spec)) return "MDF Board";
      if (/\bblockboard\b/.test(spec)) return "Block Board";
      return "Timber";
    }

    // ── Net / mesh ───────────────────────────────────────────────────────
    if (/\b(safety\s*net|shade\s*net|fishing\s*net|hdpe\s*net|nylon\s*net|mesh)\b/.test(spec)) {
      return "Safety Net";
    }

    // ── Generic: if still very long (>120 chars), truncate at first comma/period ──
    if (s.length > 120) {
      const firstBreak = s.search(/[,\.;]/);
      if (firstBreak > 8 && firstBreak < 60) {
        s = s.slice(0, firstBreak).trim();
      } else {
        // Hard truncate at 60 chars at a word boundary
        s = s.slice(0, 60).replace(/\s+\S*$/, "").trim();
      }
    }
  }

  // ── Step 1: Remove date patterns ─────────────────────────────────────────
  s = s.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, "");
  s = s.replace(/\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g, "");

  // ── Step 2: Remove invoice / reference number patterns ───────────────────
  s = s.replace(
    /\b(?:inv|sb|he|gst|bill|ref|no|sr|so|po|dc|del|note|dn|cn)[\/\-]?[\w\-\/]{2,20}\b/gi,
    ""
  );
  s = s.replace(/\b\d{2,6}\/\d{2,6}\b/g, "");
  s = s.replace(/\b[A-Z]{1,4}\d{2,}[A-Z0-9]{0,10}\b/g, (match) => {
    const preserve =
      /^(Fe|IS|HR|CR|GP|GI|MS|TMT|HRC|CRC|DRI|HBI|PCI|OPC|PPC|LPG|CNG|PNG|LNG)/i.test(
        match
      );
    return preserve ? match : "";
  });

  // ── Step 3: Remove payment & garbage tokens ──────────────────────────────
  const PAYMENT_WORDS = [
    "paying", "payment", "paid", "balance", "due", "outstanding", "receipt",
    "invoice", "bill no", "vide", "against", "advance", "deposit", "clearing",
    "settlement", "remittance", "cheque", "neft", "rtgs", "imps", "upi", "tds",
    "gst", "cgst", "sgst", "igst", "tax", "discount", "total", "amount", "rate"
  ];
  const paymentPattern = new RegExp(
    `\\b(${PAYMENT_WORDS.join("|")})\\b[^\\n]*`,
    "gi"
  );
  s = s.replace(paymentPattern, "");

  // ── Step 4: Remove Measurements & Dimensions ─────────────────────────────
  // 10 x 5, 12 mm, 38 mm, 5 mtr, 2.5 inch, Size 10 Mtr x 5 Mtr
  s = s.replace(/\b(?:size\s*:?\s*)?\d+(?:\.\d+)?\s*(?:mm|cm|inch|mtr|m|ft|sqm|sq mtr)\b/gi, " ");
  s = s.replace(/\b\d+(?:\.\d+)?\s*[xX*]\s*\d+(?:\.\d+)?(?:\s*[xX*]\s*\d+(?:\.\d+)?)?\b/g, " ");
  s = s.replace(/\b(?:size\s*)\b/gi, " ");
  s = s.replace(/\b[xX]\b/g, " "); // Strip standalone 'x' left from dimensions

  // ── Step 5: Collapse extra whitespace ─────────────────────────────────────
  s = s.replace(/\s+/g, " ").trim();

  // ── Step 6: Vendor Based Intelligence & Industry Dictionary ───────────────
  const v = String(vendorName || "").toLowerCase();
  const n = s.toLowerCase();

  // Electrical / cable vendor intelligence
  const isElectricalVendor =
    /\b(cable|wire|conductor|electric|electrical|power|energy|volt)\b/.test(v);
  if (isElectricalVendor) {
    if (/\b(aluminium|aluminum)\b/.test(n)) return "Aluminium Cable";
    if (/\bcopper\b/.test(n)) return "Copper Cable";
    if (!/\b(cable|wire|conductor|motor|switch|panel|breaker|transformer)\b/.test(n)) {
      return "Electrical Cable";
    }
  }

  // Timber intelligence
  if (v.includes("timber") || v.includes("wood") || v.includes("ply")) {
      if (!/\b(plywood|door|board|timber|wood|mdf|veneer|laminate|net)\b/.test(n)) {
          return s.length <= 3 ? "Plywood" : "Plywood"; // Default
      }
  }

  // Safety Net vendor intelligence (Realtek = safety net manufacturer)
  if (v.includes("realtek") || v.includes("safety net") || v.includes("garware")) {
      // If the cleaned name is gibberish/too short, default to Safety Net
      if (!n || n.length <= 3 || !/\b(safety|net|shade|nylon|rope|mesh|fishing)\b/.test(n)) {
          return "Safety Net";
      }
  }

  // Steel intelligence
  if (v.includes("steel") || v.includes("iron") || v.includes("metal")) {
      if (!/\b(tmt|bar|rod|coil|pipe|beam|angle|channel|scrap)\b/.test(n)) {
           return s.length < 3 ? "TMT Bar" : "TMT Bar"; // Default
      }
  }

  // Industry Dictionary
  if (/\b(?:tmt|ms|ss|gi|bars?|rods?|coils?|pipes?|beams?|angles?|channels?)\b/.test(n) && !n.includes("steel") && !n.includes("iron")) {
      if (n.includes("tmt")) return "MS TMT Bar";
  }

  if (/\b(door|door shutter|flush door|plywood|blockboard|mdf|board|wood|timber)\b/.test(n)) {
      if (n.includes("door shutter")) return "Door Shutter";
      if (n.includes("flush door")) return "Flush Door";
      if (n.includes("plywood")) return "Commercial Plywood";
      if (n.includes("mdf")) return "MDF Board";
  }

  if (n.includes("safety net") || n.includes("shade net") || n.includes("fishing net")) {
      return "Safety Net";
  }

  if (n === "m s tmt bars") return "MS TMT Bars";
  if (n.includes("tmt bars 12 mm") || n.includes("tmt bar 12mm")) return "MS TMT Bars";

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
    const itemName = normalizeItemName(rawItemName, vendorName);

    const detectedCategory = detectCategoryFromText(itemName, vendorName, item.unit);

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
      amount: item.amount || item.total,
    };
  });
}
