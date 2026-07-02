/**
 * Vendor Template Service
 * Maps vendor names to invoice types for fast routing.
 * This allows the pipeline to skip generic AI extraction
 * and jump directly to the correct domain-specific parser.
 */

export type VendorInvoiceType =
  | "steel"
  | "cement"
  | "fuel"
  | "electricity"
  | "railway"
  | "flight"
  | "freight"
  | "aluminium"
  | "plastic"
  | "paper"
  | "chemicals"
  | "unknown";

interface VendorTemplate {
  type: VendorInvoiceType;
  category: string; // emission category
  patterns: string[]; // lowercase vendor name keywords
}

const VENDOR_TEMPLATES: VendorTemplate[] = [
  // ── Steel ──────────────────────────────────────────────────────────────
  {
    type: "steel",
    category: "steel",
    patterns: [
      "kalika steel", "tata steel", "jsw steel", "jsw", "sail", "jindal",
      "essar steel", "bhushan steel", "rashtriya ispat", "rinl", "vizag steel",
      "mukand steel", "lloyds steel", "uttam steel", "kalyani steel",
      "ispat", "steel alloys", "steel industries", "steel pvt",
      "ms billet", "tmt", "steel works",
    ],
  },

  // ── Cement ─────────────────────────────────────────────────────────────
  {
    type: "cement",
    category: "cement",
    patterns: [
      "ultratech cement", "ultratech", "ambuja cement", "ambuja",
      "acc cement", "acc", "shree cement", "shree", "dalmia cement",
      "ramco cement", "prism cement", "heidelberg cement",
    ],
  },

  // ── Aluminium ──────────────────────────────────────────────────────────
  {
    type: "aluminium",
    category: "aluminium",
    patterns: [
      "hindalco", "nalco", "vedanta aluminium", "balco", "hindustan aluminium",
    ],
  },

  // ── Fuel ───────────────────────────────────────────────────────────────
  {
    type: "fuel",
    category: "fuel",
    patterns: [
      "indian oil", "iocl", "bharat petroleum", "bpcl", "hindustan petroleum",
      "hpcl", "shell", "reliance petroleum", "essar oil", "castrol",
      "total energies", "bp",
    ],
  },

  // ── Electricity ────────────────────────────────────────────────────────
  {
    type: "electricity",
    category: "electricity_bill",
    patterns: [
      "adani electricity", "tata power", "reliance energy", "msedcl",
      "bescom", "cesc", "tneb", "uppcl", "pspcl", "wbsedcl",
      "tenaga nasional", "tnb", "sp group", "meralco",
    ],
  },

  // ── Railway ────────────────────────────────────────────────────────────
  {
    type: "railway",
    category: "railway",
    patterns: [
      "irctc", "indian railways", "indian railway", "railway ticket",
      "rail ticket",
    ],
  },

  // ── Flight ─────────────────────────────────────────────────────────────
  {
    type: "flight",
    category: "flight_ticket",
    patterns: [
      "indigo", "air india", "vistara", "spicejet", "go air", "goair",
      "akasa air", "air asia", "emirates", "lufthansa", "british airways",
      "united airlines", "delta airlines", "malaysia airlines", "mas",
    ],
  },

  // ── Freight / Logistics ────────────────────────────────────────────────
  {
    type: "freight",
    category: "freight",
    patterns: [
      "blue dart", "dhl", "fedex", "ups logistics", "gati", "dtdc",
      "xpressbees", "safexpress", "transport", "cargo", "logistics pvt",
    ],
  },

  // ── Paper / Packaging ──────────────────────────────────────────────────
  {
    type: "paper",
    category: "paper",
    patterns: [
      "itc paperboards", "jk paper", "west coast paper", "tnpl",
      "ballarpur industries", "bilt",
    ],
  },
];

export interface VendorTemplateMatch {
  matched: boolean;
  type: VendorInvoiceType;
  category: string;
  pattern: string;
  confidence: number;
}

/**
 * Detect invoice type from vendor name or text.
 * Returns a match with type, category, and confidence.
 */
export function detectVendorTemplate(
  vendorName: string,
  rawText: string
): VendorTemplateMatch {
  const vendorLower = String(vendorName || "").toLowerCase();
  const textLower = String(rawText || "").toLowerCase().slice(0, 2000); // only scan first 2000 chars

  for (const template of VENDOR_TEMPLATES) {
    for (const pattern of template.patterns) {
      // Check vendor name first (high confidence)
      if (vendorLower.includes(pattern)) {
        return {
          matched: true,
          type: template.type,
          category: template.category,
          pattern,
          confidence: 0.97,
        };
      }
      // Check full text (lower confidence)
      if (textLower.includes(pattern)) {
        return {
          matched: true,
          type: template.type,
          category: template.category,
          pattern,
          confidence: 0.82,
        };
      }
    }
  }

  return {
    matched: false,
    type: "unknown",
    category: "unknown",
    pattern: "",
    confidence: 0,
  };
}
