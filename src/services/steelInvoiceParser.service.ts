/**
 * Steel Invoice Dedicated Parser
 *
 * This is the primary, regex-first parser for steel manufacturing invoices.
 * It does NOT rely on AI. It scans known table formats and extracts:
 *   - Product name (MS Billets, TMT Bars, Round Bars, etc.)
 *   - Quantity / Weight
 *   - Unit (MT, KG, etc.)
 *   - HSN code
 *   - Amount
 *
 * Supported invoice formats:
 *   Format A: Markdown-style table  | Description | Qty | Unit | Rate | Amount |
 *   Format B: Weight column table   | Description | Net Weight | Unit | Rate |
 *   Format C: Inline text           MS BILLETS 19.850 MT @ Rs.42,000
 *   Format D: Amount-first rows     1. TMT BAR FE500D | 1280 KGS | 52.00 | 66,560
 */

const NON_EMISSION_KEYWORDS = [
  "gst", "cgst", "sgst", "igst", "vat", "excise duty", "cess",
  "tcs", "tds", "discount", "round off", "rounding", "insurance",
  "transportation", "packing charges", "freight charges", "packing",
  "previous balance", "advance", "total", "subtotal", "grand total",
  "net payable", "balance due",
];

const STEEL_PRODUCT_KEYWORDS = [
  "ms billet", "billet", "tmt", "tmt bar", "round bar", "flat bar",
  "angle", "channel", "beam", "wire rod", "coil", "steel", "rebar",
  "ms bar", "ms rod", "ms plate", "ms sheet", "ms angle", "ms channel",
  "pig iron", "sponge iron", "scrap", "ingot",
];

function toNumber(value: any): number {
  const num = Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "").trim());
  return Number.isFinite(num) ? num : 0;
}

function normalizeWeightUnit(raw: string): "tonne" | "kg" | null {
  const u = raw.toLowerCase().trim();
  if (/^(mt|m\/t|m\.t\.|metric\s*ton|metric\s*tonne|tonn?e?s?)$/.test(u)) return "tonne";
  if (/^(kg|kgs|kilogram|kilograms)$/.test(u)) return "kg";
  return null;
}

function isSteelProduct(text: string): boolean {
  const lower = text.toLowerCase();
  return STEEL_PRODUCT_KEYWORDS.some(kw => lower.includes(kw));
}

function isNonEmissionRow(text: string): boolean {
  const lower = text.toLowerCase();
  return NON_EMISSION_KEYWORDS.some(kw => lower.includes(kw));
}

function detectCurrency(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("inr") || text.includes("₹") || lower.includes("rs.") || lower.includes("rupee")) return "INR";
  if (lower.includes("myr") || lower.includes("rm ")) return "MYR";
  if (lower.includes("usd") || lower.includes("$")) return "USD";
  return "INR"; // default for steel invoices
}

export interface SteelLineItem {
  item_name: string;
  description: string;
  quantity: number;
  unit: "tonne" | "kg";
  amount: number | null;
  hsn: string | null;
  currency: string;
  confidence: number;
  source: string;
  category: string;
  parameters: Record<string, any>;
}

// ── Format A: Markdown pipe-delimited table ───────────────────────────────
// | MS Billets | 19.85 | MT | 42000 | 833700 |
function parseMarkdownTable(text: string): SteelLineItem[] {
  const items: SteelLineItem[] = [];
  const currency = detectCurrency(text);

  const rows = text.split(/\n+/).filter(r => r.includes("|"));

  for (const row of rows) {
    if (/^\|[\s\-:]+\|/.test(row.trim())) continue; // separator row

    const cells = row.split("|").map(c => c.trim()).filter(c => c.length > 0);
    if (cells.length < 3) continue;

    const descCell = cells[0];
    if (!isSteelProduct(descCell) || isNonEmissionRow(descCell)) continue;

    // Try to find quantity + unit in remaining cells
    for (let j = 1; j < cells.length - 1; j++) {
      // Pattern: "19.85 MT" or "19.85" in one cell and "MT" in next
      const combined = `${cells[j]} ${cells[j + 1] || ""}`;
      const inlineMatch = combined.match(/([\d,]+(?:\.\d+)?)\s*(mt|m\/t|m\.t\.|metric\s*ton|tonn?e?s?|kg|kgs)\b/i);
      const numOnly = cells[j].match(/^([\d,]+(?:\.\d+)?)$/);
      const unitOnly = normalizeWeightUnit(cells[j + 1] || "");

      let qty = 0;
      let unit: "tonne" | "kg" | null = null;

      if (inlineMatch) {
        qty = toNumber(inlineMatch[1]);
        unit = normalizeWeightUnit(inlineMatch[2]);
      } else if (numOnly && unitOnly) {
        qty = toNumber(numOnly[1]);
        unit = unitOnly;
      }

      if (qty > 0 && unit) {
        const amountCell = cells[cells.length - 1];
        const amount = toNumber(amountCell);
        items.push({
          item_name: descCell.slice(0, 120),
          description: descCell,
          quantity: qty,
          unit,
          amount: amount > 0 ? amount : null,
          hsn: null,
          currency,
          confidence: 0.92,
          source: "steel_parser_markdown_table",
          category: "steel",
          parameters: {
            category: "steel",
            country: "IN",
            region: "IN",
            extraction_method: "steel_invoice_parser",
          },
        });
        break;
      }
    }
  }

  return items;
}

// ── Format B: Flattened text table (OCR linearized) ──────────────────────
// Description Qty Unit Rate Amount
// MS Billets 19.85 MT 42000 833700
function parseFlatTable(text: string): SteelLineItem[] {
  const items: SteelLineItem[] = [];
  const currency = detectCurrency(text);

  // Weight unit immediately after a number
  const rowPattern = new RegExp(
    `(${STEEL_PRODUCT_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})` +
    `[^\\n]{0,80}?` +
    `((?:[\\d,]+(?:\\.\\d+)?))\\s*(mt|m\\/t|m\\.t\\.|metric\\s*ton|tonn?e?s?|kg|kgs)\\b`,
    "gi"
  );

  let match: RegExpExecArray | null;
  const flatText = text.replace(/\n/g, " ");

  while ((match = rowPattern.exec(flatText)) !== null) {
    const product = match[1];
    const qty = toNumber(match[2]);
    const unit = normalizeWeightUnit(match[3]);

    if (!product || qty <= 0 || !unit) continue;
    if (isNonEmissionRow(product)) continue;

    // Try to grab amount from nearby text
    const afterMatch = flatText.slice(match.index + match[0].length, match.index + match[0].length + 80);
    const amountMatch = afterMatch.match(/([\d,]{3,}(?:\.\d{1,2})?)/);
    const amount = amountMatch ? toNumber(amountMatch[1]) : null;

    items.push({
      item_name: product.trim().slice(0, 120),
      description: product.trim(),
      quantity: qty,
      unit,
      amount,
      hsn: null,
      currency,
      confidence: 0.88,
      source: "steel_parser_flat_table",
      category: "steel",
      parameters: {
        category: "steel",
        country: "IN",
        region: "IN",
        extraction_method: "steel_invoice_parser",
      },
    });
  }

  return items;
}

// ── Format C: Net Weight / Gross Weight column ───────────────────────────
// MS BILLETS  Net Wt: 19.850 MT  Gross Wt: 20.000 MT
function parseWeightColumnFormat(text: string): SteelLineItem[] {
  const items: SteelLineItem[] = [];
  const currency = detectCurrency(text);

  const patterns = [
    /(?:net\s*w(?:eigh)?t|net\s*wt)[\s:]*([,\d]+(?:\.\d+)?)\s*(mt|m\/t|m\.t\.|tonn?e?s?|kg|kgs)\b/gi,
    /(?:gross\s*w(?:eigh)?t|gross\s*wt)[\s:]*([,\d]+(?:\.\d+)?)\s*(mt|m\/t|m\.t\.|tonn?e?s?|kg|kgs)\b/gi,
    /(?:weight|wt)[\s:]*([,\d]+(?:\.\d+)?)\s*(mt|m\/t|m\.t\.|tonn?e?s?|kg|kgs)\b/gi,
  ];

  // Find which steel product this belongs to
  const productMatch = STEEL_PRODUCT_KEYWORDS
    .map(kw => ({ kw, idx: text.toLowerCase().indexOf(kw) }))
    .filter(x => x.idx >= 0)
    .sort((a, b) => a.idx - b.idx)[0];

  const productName = productMatch
    ? text.slice(productMatch.idx, productMatch.idx + 30).split(/[\n|]/)[0].trim()
    : "Steel Material";

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const qty = toNumber(match[1]);
      const unit = normalizeWeightUnit(match[2]);
      if (qty > 0 && unit) {
        items.push({
          item_name: productName.slice(0, 120),
          description: productName,
          quantity: qty,
          unit,
          amount: null,
          hsn: null,
          currency,
          confidence: 0.85,
          source: "steel_parser_weight_column",
          category: "steel",
          parameters: {
            category: "steel",
            country: "IN",
            region: "IN",
            extraction_method: "steel_invoice_parser",
            weight_type: match[0].toLowerCase().startsWith("net") ? "net_weight" : "gross_weight",
          },
        });
        return items; // Return first successful weight match
      }
    }
  }

  return items;
}

// ── Format D: Standalone weight value anywhere in text ───────────────────
// "Total: 19.850 MT" or just "19.850 MT" on its own line
function parseStandaloneWeight(text: string, itemName: string): SteelLineItem | null {
  const currency = detectCurrency(text);

  const patterns = [
    /([\d,]+(?:\.\d+)?)\s*(m\/t|m\.t\.)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(metric\s*ton(?:ne)?)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(mt)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(tonn?e?s?)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(kgs?)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const qty = toNumber(match[1]);
      const unit = normalizeWeightUnit(match[2]);
      if (qty > 0 && unit && qty < 100000) {
        return {
          item_name: itemName.slice(0, 120),
          description: itemName,
          quantity: qty,
          unit,
          amount: null,
          hsn: null,
          currency,
          confidence: 0.78,
          source: "steel_parser_standalone_weight",
          category: "steel",
          parameters: {
            category: "steel",
            country: "IN",
            region: "IN",
            extraction_method: "steel_invoice_parser",
          },
        };
      }
    }
  }

  return null;
}

/**
 * Main entry point: parse a steel invoice text and extract line items.
 * Tries formats in priority order: Markdown table → Flat table → Weight column → Standalone.
 */
export function parseSteelInvoice(rawText: string): SteelLineItem[] {
  const text = String(rawText || "");

  // Try Format A
  const mdItems = parseMarkdownTable(text);
  if (mdItems.length > 0) return mdItems;

  // Try Format B
  const flatItems = parseFlatTable(text);
  if (flatItems.length > 0) return flatItems;

  // Try Format C
  const weightItems = parseWeightColumnFormat(text);
  if (weightItems.length > 0) return weightItems;

  // Try Format D — find the dominant steel product name first
  const productMatch = STEEL_PRODUCT_KEYWORDS
    .map(kw => ({ kw, idx: text.toLowerCase().indexOf(kw) }))
    .filter(x => x.idx >= 0)
    .sort((a, b) => a.idx - b.idx)[0];

  if (productMatch) {
    const name = text.slice(productMatch.idx, productMatch.idx + 60).split(/[\n|]/)[0].trim();
    const standalone = parseStandaloneWeight(text, name);
    if (standalone) return [standalone];
  }

  return [];
}

/**
 * Checks if a text is likely a steel/manufacturing invoice
 * so the router knows to send it to this parser.
 */
export function isSteelInvoice(text: string, vendorName?: string): boolean {
  const combined = `${text} ${vendorName || ""}`.toLowerCase().slice(0, 3000);
  const hits = STEEL_PRODUCT_KEYWORDS.filter(kw => combined.includes(kw));
  return hits.length >= 1;
}
