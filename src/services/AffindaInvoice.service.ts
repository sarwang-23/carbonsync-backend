import fs from "fs";
import axios from "axios";
import FormData from "form-data";

const AFFINDA_API_KEY = process.env.AFFINDA_API_KEY?.trim();
const AFFINDA_WORKSPACE_ID = process.env.AFFINDA_WORKSPACE_ID?.trim();
const AFFINDA_DOCUMENT_TYPE_ID = process.env.AFFINDA_DOCUMENT_TYPE_ID?.trim();

export type NormalizedInvoiceItem = {
  name: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  amount?: number | null;
  currency?: string | null;
};

export type NormalizedInvoice = {
  provider: string;
  vendorName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  lineItems: NormalizedInvoiceItem[];
  rawResponse?: any;
};

function safeNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function getFieldValue(data: any, fieldName: string): any {
  if (!data) return undefined;

  if (data[fieldName]?.value !== undefined) {
    return data[fieldName].value;
  }

  if (data[fieldName] !== undefined) {
    return data[fieldName];
  }

  return undefined;
}

function normalizeCurrency(value?: string | null) {
  if (!value) return "MYR";

  const v = String(value).trim().toUpperCase();

  if (v === "RM") return "MYR";
  if (v === "MYR") return "MYR";

  return v;
}

function getUsageFromUsageTable(data: any) {
  const usageTable =
    getFieldValue(data, "usageTable") ||
    getFieldValue(data, "Usage Table");

  if (!Array.isArray(usageTable) || usageTable.length === 0) return null;

  const firstBlock = usageTable[0];
  const rows = firstBlock?.rows || firstBlock?.value?.rows || [];

  if (!Array.isArray(rows) || rows.length === 0) return null;

  const firstRow = rows[0];

  const usage =
    safeNumber(firstRow.usage) ||
    safeNumber(firstRow.Usage) ||
    safeNumber(firstRow["Usage"]);

  if (!usage) return null;

  return {
    value: usage,
    unit: "kWh",
    meterNumber: firstRow.meterNumber || firstRow["Meter Number"] || null,
    startRead: safeNumber(firstRow.startRead || firstRow["Start Read"]),
    endRead: safeNumber(firstRow.endRead || firstRow["End Read"]),
  };
}

function getEnergyFromChargesTable(data: any) {
  const chargesTable =
    getFieldValue(data, "chargesTable") ||
    getFieldValue(data, "Charges Table");

  if (!Array.isArray(chargesTable) || chargesTable.length === 0) return null;

  const firstBlock = chargesTable[0];
  const rows = firstBlock?.rows || firstBlock?.value?.rows || [];

  if (!Array.isArray(rows)) return null;

  for (const row of rows) {
    const description = String(row.description || row["Charge Description"] || "");

    const match = description.match(/([\d,]+(?:\.\d+)?)\s*kwh/i);

    if (match) {
      return {
        value: Number(match[1].replace(/,/g, "")),
        unit: "kWh",
      };
    }
  }

  return null;
}

function buildTnbElectricityItem(data: any): NormalizedInvoiceItem | null {
  const usageFromTable = getUsageFromUsageTable(data);
  const energyFromCharges = getEnergyFromChargesTable(data);

  const energyValue =
    safeNumber(getFieldValue(data, "electricityConsumption")) ||
    safeNumber(getFieldValue(data, "Electricity Consumption")) ||
    usageFromTable?.value ||
    energyFromCharges?.value;

  const energyUnit =
    getFieldValue(data, "consumptionUnit") ||
    getFieldValue(data, "Consumption Unit") ||
    usageFromTable?.unit ||
    energyFromCharges?.unit ||
    "kWh";

  const totalAmount =
    safeNumber(getFieldValue(data, "totalBalance")) ||
    safeNumber(getFieldValue(data, "Total Balance")) ||
    safeNumber(getFieldValue(data, "newCharges")) ||
    safeNumber(getFieldValue(data, "New Charges"));

  const supplierName =
    getFieldValue(data, "supplierName") ||
    getFieldValue(data, "Supplier Name") ||
    "TENAGA NASIONAL";

  if (!energyValue) return null;

  return {
    name: `${supplierName} Electricity Consumption`,
    description: "Electricity consumption extracted from TNB utility bill",
    quantity: energyValue,
    unit: String(energyUnit || "kWh"),
    unitPrice: null,
    amount: totalAmount,
    currency: "MYR",
  };
}

export async function extractInvoiceWithAffinda(
  filePath: string
): Promise<NormalizedInvoice> {
  if (!AFFINDA_API_KEY) {
    throw new Error("AFFINDA_API_KEY missing");
  }

  if (!AFFINDA_WORKSPACE_ID) {
    throw new Error("AFFINDA_WORKSPACE_ID missing");
  }

  if (!AFFINDA_DOCUMENT_TYPE_ID) {
    throw new Error("AFFINDA_DOCUMENT_TYPE_ID missing");
  }

  console.log("AFFINDA_API_KEY exists:", !!AFFINDA_API_KEY);
  console.log("AFFINDA_WORKSPACE_ID:", AFFINDA_WORKSPACE_ID);
  console.log("AFFINDA_DOCUMENT_TYPE_ID:", AFFINDA_DOCUMENT_TYPE_ID);
  console.log("FILE PATH:", filePath);
  console.log("FILE EXISTS:", fs.existsSync(filePath));

  const fileBuffer = fs.readFileSync(filePath);
  console.log("FILE BUFFER SIZE (bytes):", fileBuffer.length);

  const form = new FormData();

  form.append("file", fileBuffer, {
    filename: "electricity-bill.pdf",
    contentType: "application/pdf",
  });

  form.append("workspace", AFFINDA_WORKSPACE_ID);
  form.append("documentType", AFFINDA_DOCUMENT_TYPE_ID);

  try {
    const response = await axios.post(
      "https://api.affinda.com/v3/documents",
      form,
      {
        headers: {
          Authorization: `Bearer ${AFFINDA_API_KEY}`,
          ...form.getHeaders(),
        },
        timeout: 120000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    const doc = response.data;
    const data = doc?.data || doc?.document?.data || {};

    console.log("AFFINDA_RAW_RESPONSE_KEYS:", Object.keys(doc || {}));
    console.log("AFFINDA_DATA_KEYS:", Object.keys(data || {}));

    const electricityItem = buildTnbElectricityItem(data);

    const lineItems: NormalizedInvoiceItem[] = [];

    if (electricityItem) {
      console.log("AFFINDA_LINE_ITEM_BUILT:", electricityItem);
      lineItems.push(electricityItem);
    } else {
      console.warn("AFFINDA: no electricity item extracted — check data keys");
    }

    const supplierName =
      getFieldValue(data, "supplierName") ||
      getFieldValue(data, "Supplier Name") ||
      "TENAGA NASIONAL";

    const invoiceDate =
      getFieldValue(data, "issueDate") ||
      getFieldValue(data, "Issue Date") ||
      null;

    const invoiceNumber =
      getFieldValue(data, "customerAccountNumber") ||
      getFieldValue(data, "Customer Account Number") ||
      null;

    const total =
      safeNumber(getFieldValue(data, "totalBalance")) ||
      safeNumber(getFieldValue(data, "Total Balance")) ||
      safeNumber(getFieldValue(data, "newCharges")) ||
      safeNumber(getFieldValue(data, "New Charges")) ||
      electricityItem?.amount ||
      null;

    return {
      provider: "affinda",
      vendorName: supplierName,
      invoiceNumber,
      invoiceDate,
      currency: "MYR",
      subtotal: null,
      tax: null,
      total,
      lineItems,
      rawResponse: doc,
    };
  } catch (error: any) {
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
