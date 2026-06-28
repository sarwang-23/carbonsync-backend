import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import type { NormalizedInvoice, NormalizedInvoiceItem } from "../types/invoice.types.js";

const AFFINDA_API_KEY = process.env.AFFINDA_API_KEY?.trim();
const AFFINDA_WORKSPACE_ID = process.env.AFFINDA_WORKSPACE_ID?.trim();
const AFFINDA_DOCUMENT_TYPE_ID = process.env.AFFINDA_DOCUMENT_TYPE_ID?.trim();

function getFieldValue(data: any, fieldName: string): any {
  if (!data) return undefined;

  const field = data[fieldName];

  if (field === null || field === undefined) return undefined;

  if (typeof field === "object" && !Array.isArray(field)) {
    if (field.parsed !== undefined && field.parsed !== null) return field.parsed;
    if (field.raw !== undefined && field.raw !== null) return field.raw;
    if (field.value !== undefined && field.value !== null) return field.value;
  }

  return field;
}

function getCellValue(row: any, fieldName: string): any {
  if (!row) return undefined;

  const value = row[fieldName];

  if (value === null || value === undefined) return undefined;

  if (typeof value === "object" && !Array.isArray(value)) {
    if (value.parsed !== undefined && value.parsed !== null) return value.parsed;
    if (value.raw !== undefined && value.raw !== null) return value.raw;
    if (value.value !== undefined && value.value !== null) return value.value;
  }

  return value;
}

function safeNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "object") {
    if (value.parsed !== undefined) value = value.parsed;
    else if (value.raw !== undefined) value = value.raw;
    else if (value.value !== undefined) value = value.value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractQuantityAndUnitFromText(text: string) {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(kwh|kwhr|kwj)/i,
    /(\d+(?:\.\d+)?)\s*(litre|liter|ltr|l)\b/i,
    /(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms)\b/i,
    /(\d+(?:\.\d+)?)\s*(tonne|tonnes|ton|tons|mt)\b/i,
    /(\d+(?:\.\d+)?)\s*(m3|m³|cubic meter|cubic metre)\b/i,
    /(\d+(?:\.\d+)?)\s*(km|kms|kilometer|kilometre)\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        quantity: Number(match[1]),
        unit: match[2]
      };
    }
  }

  return null;
}

function normalizeAffindaLineItems(rawLineItems: any[], currency = "MYR"): NormalizedInvoiceItem[] {
  if (!Array.isArray(rawLineItems)) return [];

  return rawLineItems
    .map((line: any) => {
      const row = line?.value || line;

      const name =
        getFieldValue(row, "description") ||
        getFieldValue(row, "name") ||
        getFieldValue(row, "item") ||
        getFieldValue(row, "product") ||
        "";

      const textName = String(name || "").trim();
      const extractedFromText = extractQuantityAndUnitFromText(textName);

      const quantity =
        safeNumber(getFieldValue(row, "quantity")) ||
        safeNumber(getFieldValue(row, "qty")) ||
        extractedFromText?.quantity ||
        null;

      const unit =
        getFieldValue(row, "unit") ||
        getFieldValue(row, "uom") ||
        getFieldValue(row, "unitOfMeasure") ||
        extractedFromText?.unit ||
        null;

      const unitPrice =
        safeNumber(getFieldValue(row, "unitPrice")) ||
        safeNumber(getFieldValue(row, "price"));

      const amount =
        safeNumber(getFieldValue(row, "amount")) ||
        safeNumber(getFieldValue(row, "total"));

      return {
        name: textName,
        description: textName,
        quantity,
        unit: unit ? String(unit).trim() : null,
        unitPrice,
        amount,
        currency
      };
    })
    .filter((item) => item.name.length > 0);
}

function extractCommercialTnbItemsFromRawText(
  rawText: string,
  supplierName = "TENAGA NASIONAL"
): NormalizedInvoiceItem[] {
  const text = String(rawText || "").replace(/\s+/g, " ");

  const items: NormalizedInvoiceItem[] = [];

  const peakMatch = text.match(
    /Penggunaan\s+Puncak\s*\(kWh\)\s*([\d,]+(?:\.\d+)?)\s*([\d.]+)\s*([\d,]+(?:\.\d+)?)/i
  );

  const offPeakMatch = text.match(
    /Penggunaan\s+Luar\s+Puncak\s*\(kWh\)\s*([\d,]+(?:\.\d+)?)\s*([\d.]+)\s*([\d,]+(?:\.\d+)?)/i
  );

  if (peakMatch) {
    items.push({
      name: `${supplierName} Peak Electricity Consumption`,
      description: "Penggunaan Puncak (kWh)",
      quantity: safeNumber(peakMatch[1]),
      unit: "kWh",
      unitPrice: safeNumber(peakMatch[2]),
      amount: safeNumber(peakMatch[3]),
      currency: "MYR",
    });
  }

  if (offPeakMatch) {
    items.push({
      name: `${supplierName} Off-Peak Electricity Consumption`,
      description: "Penggunaan Luar Puncak (kWh)",
      quantity: safeNumber(offPeakMatch[1]),
      unit: "kWh",
      unitPrice: safeNumber(offPeakMatch[2]),
      amount: safeNumber(offPeakMatch[3]),
      currency: "MYR",
    });
  }

  return items.filter((item) => item.quantity && item.quantity > 0);
}

function extractTotalAmount(data: any): number | null {
  return (
    safeNumber(getFieldValue(data, "totalBalance")) ||
    safeNumber(getFieldValue(data, "Total Balance")) ||
    safeNumber(getFieldValue(data, "newCharges")) ||
    safeNumber(getFieldValue(data, "New Charges")) ||
    safeNumber(getFieldValue(data, "totalBillAmount")) ||
    safeNumber(getFieldValue(data, "Total Bill Amount")) ||
    null
  );
}

function getUsageFromUsageTable(data: any): { value: number; unit: string } | null {
  const usageTable = getFieldValue(data, "usageTable") || getFieldValue(data, "Usage Table");
  if (!Array.isArray(usageTable) || usageTable.length === 0) return null;

  const firstRow = usageTable[0]?.value || usageTable[0];
  if (!firstRow) return null;

  const usage = safeNumber(getCellValue(firstRow, "usage")) || safeNumber(getCellValue(firstRow, "Usage"));
  if (!usage) return null;

  const unit =
    getCellValue(firstRow, "unit") ||
    getCellValue(firstRow, "Unit") ||
    "kWh";

  const normalizedUnit = String(unit).trim().toLowerCase();

  if (
    normalizedUnit.includes("kvarh") ||
    normalizedUnit.includes("kwh p") ||
    normalizedUnit.includes("kwh o") ||
    normalizedUnit === "kw" ||
    normalizedUnit.includes("kw p") ||
    normalizedUnit.includes("kw o")
  ) {
    return null;
  }

  return { value: usage, unit: String(unit).trim() };
}

function buildTnbElectricityItems(data: any): NormalizedInvoiceItem[] {
  const supplierName =
    getFieldValue(data, "supplierName") ||
    getFieldValue(data, "Supplier Name") ||
    "TENAGA NASIONAL";

  const total = extractTotalAmount(data);

  const rawText =
    String(data?.rawText || getFieldValue(data, "rawText") || "");

  // IMPORTANT:
  // Commercial LPC bill ko pehle detect karo.
  // Isse meter table ka 793,689 kWh P galti se primary consumption nahi banega.
  const commercialItems = extractCommercialTnbItemsFromRawText(
    rawText,
    String(supplierName)
  );

  if (commercialItems.length > 0) {
    return commercialItems;
  }

  // Normal residential/simple TNB bill
  const directConsumption =
    safeNumber(getFieldValue(data, "electricityConsumption")) ||
    safeNumber(getFieldValue(data, "Electricity Consumption"));

  const unit =
    getFieldValue(data, "consumptionUnit") ||
    getFieldValue(data, "Consumption Unit") ||
    "kWh";

  if (directConsumption) {
    return [
      {
        name: `${supplierName} Electricity Consumption`,
        description: "Electricity consumption extracted from TNB utility bill",
        quantity: directConsumption,
        unit: String(unit || "kWh"),
        unitPrice: null,
        amount: total,
        currency: "MYR",
      },
    ];
  }

  // Last fallback: usageTable
  // But skip complex units like kWh P / kWh O / kVARh for commercial bills.
  const usageFromTable = getUsageFromUsageTable(data);

  if (usageFromTable?.value) {
    const normalizedUnit = String(usageFromTable.unit || "kWh").trim();

    if (normalizedUnit.toLowerCase() === "kwh") {
      return [
        {
          name: `${supplierName} Electricity Consumption`,
          description: "Electricity consumption extracted from meter usage table",
          quantity: usageFromTable.value,
          unit: "kWh",
          unitPrice: null,
          amount: total,
          currency: "MYR",
        },
      ];
    }
  }

  return [];
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

  const form = new FormData();
  const fileBuffer = fs.readFileSync(filePath);

  form.append("file", fileBuffer, {
    filename: "electricity-bill.pdf",
    contentType: "application/pdf",
  });

  form.append("workspace", AFFINDA_WORKSPACE_ID!.trim());
  
  if (AFFINDA_DOCUMENT_TYPE_ID) {
    form.append("documentType", AFFINDA_DOCUMENT_TYPE_ID!.trim());
  }

  const response = await axios.post(
    "https://api.affinda.com/v3/documents",
    form,
    {
      headers: {
        Authorization: `Bearer ${AFFINDA_API_KEY}`,
        ...form.getHeaders()
      },
      timeout: 120000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    }
  );

  const doc = response.data;
  const data = doc?.data || doc?.document?.data || doc;

  const lineItems = buildTnbElectricityItems(data);

  return {
    provider: "affinda",
    vendorName:
      getFieldValue(data, "supplierName") ||
      getFieldValue(data, "Supplier Name") ||
      "TENAGA NASIONAL",
    invoiceNumber:
      getFieldValue(data, "customerAccountNumber") ||
      getFieldValue(data, "Customer Account Number") ||
      null,
    invoiceDate:
      getFieldValue(data, "issueDate") ||
      getFieldValue(data, "Issue Date") ||
      null,
    currency: "MYR",
    subtotal: null,
    tax: null,
    total:
      extractTotalAmount(data) ||
      lineItems[0]?.amount ||
      null,
    lineItems,
    rawResponse: doc,
  };
}
