import fs from "fs";
import FormData from "form-data";
import axios from "axios";

// ─── Helper Utilities ────────────────────────────────────────────────────────

/**
 * Traverse a nested object path.
 * If any key's value has a `.value` property, unwrap it automatically.
 */
function getNestedValue(obj: any, path: string[]): any {
  let current = obj;

  for (const key of path) {
    if (!current) return undefined;

    if (current[key]?.value !== undefined) {
      current = current[key].value;
    } else {
      current = current[key];
    }
  }

  return current;
}

function safeNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrency(unit?: string | null): string {
  if (!unit) return "MYR";

  const value = String(unit).trim().toUpperCase();

  if (value === "RM") return "MYR";
  if (value === "MYR") return "MYR";

  return value;
}

// ─── Activity Data → Line Item ────────────────────────────────────────────────

/**
 * Converts the Affinda `activityData` block into a normalized line item.
 *
 * Expected input shape (from Affinda JSON):
 * {
 *   activityData: {
 *     energy: { value: 2169, unit: "kWh" },
 *     money:  { value: 1108.82, unit: "RM" }
 *   }
 * }
 *
 * Output:
 * {
 *   name: "TENAGA NASIONAL Electricity Consumption",
 *   quantity: 2169,
 *   unit: "kWh",
 *   amount: 1108.82,
 *   currency: "MYR"
 * }
 */
function buildUtilityBillLineItemFromActivityData(data: any) {
  // Energy value — try camelCase and "Activity Data" (space) variations
  const energyValue =
    safeNumber(getNestedValue(data, ["activityData", "energy", "value"])) ||
    safeNumber(getNestedValue(data, ["Activity Data", "energy", "value"])) ||
    safeNumber(getNestedValue(data, ["energy", "value"]));

  const energyUnit =
    getNestedValue(data, ["activityData", "energy", "unit"]) ||
    getNestedValue(data, ["Activity Data", "energy", "unit"]) ||
    getNestedValue(data, ["energy", "unit"]) ||
    "kWh";

  // Money value
  const moneyValue =
    safeNumber(getNestedValue(data, ["activityData", "money", "value"])) ||
    safeNumber(getNestedValue(data, ["Activity Data", "money", "value"])) ||
    safeNumber(getNestedValue(data, ["money", "value"]));

  const moneyUnit =
    getNestedValue(data, ["activityData", "money", "unit"]) ||
    getNestedValue(data, ["Activity Data", "money", "unit"]) ||
    getNestedValue(data, ["money", "unit"]) ||
    "MYR";

  if (!energyValue) return null;

  return {
    name: "TENAGA NASIONAL Electricity Consumption",
    description: "Electricity consumption extracted from utility bill",
    quantity: energyValue,
    unit: String(energyUnit || "kWh"),
    unitPrice: null as number | null,
    amount: moneyValue || null,
    currency: normalizeCurrency(String(moneyUnit || "MYR")),
  };
}

// ─── Standard line-item normalizer ───────────────────────────────────────────

function normalizeLineItems(rawItems: any[]): any[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item: any) => {
      const desc =
        item?.description?.value ??
        item?.description ??
        item?.item_name ??
        item?.name ??
        "Unknown Item";

      const qty =
        safeNumber(item?.quantity?.value ?? item?.quantity) ?? 1;

      const unit = String(
        item?.unit?.value ?? item?.unit ?? ""
      ).trim();

      const unitPrice =
        safeNumber(item?.unitPrice?.value ?? item?.unitPrice) ?? null;

      const amount =
        safeNumber(item?.lineTotal?.value ?? item?.lineTotal ?? item?.amount) ?? null;

      const currency = normalizeCurrency(
        item?.currency?.value ?? item?.currency ?? null
      );

      return {
        name: desc,
        quantity: qty,
        unit,
        unitPrice,
        amount,
        currency,
      };
    })
    .filter((item) => item.name && item.name !== "Unknown Item");
}

// ─── Affinda API Call ─────────────────────────────────────────────────────────

export interface AffindaLineItem {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  amount: number | null;
  currency: string;
}

export interface AffindaExtractionResult {
  provider: "affinda";
  vendorName: string | null;
  invoiceDate: string | null;
  currency: string | null;
  total: number | null;
  lineItems: AffindaLineItem[];
  raw: any;
}

export async function extractInvoiceWithAffinda(
  filePath: string
): Promise<AffindaExtractionResult> {
  const apiKey = process.env.AFFINDA_API_KEY;

  if (!apiKey) {
    throw new Error("AFFINDA_API_KEY is not set in environment variables.");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found at path: ${filePath}`);
  }

  const formData = new FormData();
  formData.append("file", fs.createReadStream(filePath));
  formData.append("collection", process.env.AFFINDA_COLLECTION_ID || "");

  console.log("AFFINDA_EXTRACTION_STARTED", { filePath });

  let responseData: any;

  try {
    const response = await axios.post(
      "https://api.affinda.com/v3/documents",
      formData,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...formData.getHeaders(),
        },
        timeout: 60_000,
      }
    );

    responseData = response.data;
  } catch (err: any) {
    const detail =
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err?.message ||
      String(err);
    console.error("AFFINDA_API_ERROR", detail);
    throw new Error(`Affinda API call failed: ${detail}`);
  }

  console.log("AFFINDA_RAW_RESPONSE_KEYS", Object.keys(responseData || {}));

  // The parsed document lives under `data`
  const doc = responseData?.data ?? responseData;

  // ── Vendor / date / currency / total ─────────────────────────────────────
  const vendorName =
    doc?.supplierName?.value ??
    doc?.supplier?.name?.value ??
    doc?.vendorName?.value ??
    null;

  const invoiceDate =
    doc?.invoiceDate?.value ??
    doc?.date?.value ??
    null;

  const currency = normalizeCurrency(
    doc?.currency?.value ?? doc?.currencyCode?.value ?? null
  );

  const total =
    safeNumber(doc?.invoiceTotal?.value ?? doc?.total?.value ?? null);

  // ── Line Items ────────────────────────────────────────────────────────────
  let lineItems: AffindaLineItem[] = [];

  // 1. Try activityData block first (utility bills like TNB)
  const activityItem = buildUtilityBillLineItemFromActivityData(doc);
  if (activityItem) {
    console.log("AFFINDA_ACTIVITY_DATA_LINE_ITEM_BUILT", activityItem);
    lineItems = [activityItem];
  }

  // 2. Fallback: standard invoice line items
  if (!lineItems.length) {
    const rawItems =
      doc?.lineItems?.value ??
      doc?.lineItems ??
      doc?.items ??
      [];

    lineItems = normalizeLineItems(rawItems);
    console.log(`AFFINDA_STANDARD_LINE_ITEMS_PARSED: ${lineItems.length}`);
  }

  const result: AffindaExtractionResult = {
    provider: "affinda",
    vendorName,
    invoiceDate,
    currency,
    total,
    lineItems,
    raw: doc,
  };

  console.log("AFFINDA_EXTRACTION_COMPLETE", {
    vendorName,
    invoiceDate,
    currency,
    total,
    lineItemCount: lineItems.length,
  });

  return result;
}
