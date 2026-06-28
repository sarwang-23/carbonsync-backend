import fs from "fs";
import FormData from "form-data";
import axios from "axios";

// ─── Env (trimmed to avoid whitespace issues) ─────────────────────────────────
const AFFINDA_API_KEY = process.env.AFFINDA_API_KEY?.trim();
const AFFINDA_WORKSPACE_ID = process.env.AFFINDA_WORKSPACE_ID?.trim();
const AFFINDA_COLLECTION_ID = process.env.AFFINDA_COLLECTION_ID?.trim();

// ─── Helper Utilities ─────────────────────────────────────────────────────────

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
 */
export function buildUtilityBillLineItemFromActivityData(data: any) {
  const energyValue =
    safeNumber(getNestedValue(data, ["activityData", "energy", "value"])) ||
    safeNumber(getNestedValue(data, ["Activity Data", "energy", "value"])) ||
    safeNumber(getNestedValue(data, ["energy", "value"]));

  const energyUnit =
    getNestedValue(data, ["activityData", "energy", "unit"]) ||
    getNestedValue(data, ["Activity Data", "energy", "unit"]) ||
    getNestedValue(data, ["energy", "unit"]) ||
    "kWh";

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

// ─── Affinda API Call ─────────────────────────────────────────────────────────

export async function extractInvoiceWithAffinda(filePath: string) {
  // ── Guard: env vars ────────────────────────────────────────────────────────
  if (!AFFINDA_API_KEY) {
    throw new Error("AFFINDA_API_KEY missing or empty in .env");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found at path: ${filePath}`);
  }

  // ── Debug: confirm env loaded ──────────────────────────────────────────────
  console.log("AFFINDA_API_KEY exists:", !!AFFINDA_API_KEY);
  console.log("AFFINDA_WORKSPACE_ID:", AFFINDA_WORKSPACE_ID);
  console.log("AFFINDA_COLLECTION_ID:", AFFINDA_COLLECTION_ID);
  console.log("AFFINDA_EXTRACTION_STARTED:", filePath);

  // ── File debug ─────────────────────────────────────────────────────────────
  console.log("FILE PATH:", filePath);
  console.log("FILE EXISTS:", fs.existsSync(filePath));

  // ── Build form — ONLY collection, explicit filename to avoid ECONNRESET ────
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), {
    filename: "bill.pdf",
  });
  form.append("collection", AFFINDA_COLLECTION_ID!);
  console.log("AFFINDA_FORM: sending collection =", AFFINDA_COLLECTION_ID);

  try {
    const response = await axios.post(
      "https://api.affinda.com/v3/documents",
      form,
      {
        headers: {
          Authorization: `Bearer ${AFFINDA_API_KEY}`,
          ...form.getHeaders(),
          Connection: "keep-alive",
        },
        timeout: 60_000,
      }
    );

    const doc = response.data;
    const data = doc?.data || doc?.document?.data || doc;

    console.log("AFFINDA_RAW_RESPONSE_KEYS:", Object.keys(doc || {}));
    console.log("AFFINDA_DATA_KEYS:", Object.keys(data || {}));

    // ── Parse line item from activityData ─────────────────────────────────
    const utilityItem = buildUtilityBillLineItemFromActivityData(data);

    const lineItems = [];
    if (utilityItem) {
      console.log("AFFINDA_ACTIVITY_DATA_LINE_ITEM_BUILT:", utilityItem);
      lineItems.push(utilityItem);
    } else {
      console.log("AFFINDA_ACTIVITY_DATA: no energy value found, lineItems=[]");
    }

    return {
      provider: "affinda" as const,
      vendorName: "TENAGA NASIONAL",
      invoiceNumber: null as string | null,
      invoiceDate: data?.date?.value ?? data?.date ?? null,
      currency: utilityItem?.currency || "MYR",
      subtotal: null as number | null,
      tax: null as number | null,
      total: utilityItem?.amount || null,
      lineItems,
      rawResponse: doc,
    };

  } catch (error: any) {
    // ── Detailed error logging ─────────────────────────────────────────────
    console.error("AFFINDA STATUS:", error?.response?.status);
    console.error(
      "AFFINDA ERROR DATA:",
      JSON.stringify(error?.response?.data, null, 2)
    );
    console.error("AFFINDA ERROR MESSAGE:", error.message);

    throw new Error(
      `Affinda API call failed: ${
        JSON.stringify(error?.response?.data) || error.message
      }`
    );
  }
}
