import db from "../db.js";

export type EmissionFactorMapping = {
  id?: string;

  // Dynamic DB fields. Your Supabase table may have different columns,
  // so keep this type flexible.
  [key: string]: any;

  // Compatibility fields used by src/app.ts
  activity_id: string | null;
  requested_region: string | null;
  parameter_name: string | null;
  data_version: string;
};

const TABLE_SCHEMA = "public";
const TABLE_NAME = "emission_factor_mappings";

let cachedColumns: Set<string> | null = null;

async function getMappingColumns(): Promise<Set<string>> {
  if (cachedColumns) return cachedColumns;

  const result = await db.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    `,
    [TABLE_SCHEMA, TABLE_NAME]
  );

  cachedColumns = new Set(result.rows.map((row: any) => String(row.column_name)));
  return cachedColumns;
}

function hasColumn(columns: Set<string>, columnName: string): boolean {
  return columns.has(columnName);
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function mapUnitTypeToParameterName(value?: string | null): string | null {
  const unit = String(value || "").toLowerCase().trim();

  if (["energy", "electricity", "kwh", "kw h"].includes(unit)) return "energy";
  if (["mass", "weight", "kg", "kgs", "tonne", "tonnes", "ton", "mt"].includes(unit)) return "weight";
  if (["volume", "litre", "liter", "litres", "liters", "l", "m3", "cubic_meter", "cubic metre"].includes(unit)) return "volume";
  if (["distance", "km", "kilometre", "kilometer"].includes(unit)) return "distance";

  return unit || null;
}

function buildManualActivityId(row: any): string | null {
  const text = [
    row?.pattern,
    row?.item_keywords,
    row?.keyword,
    row?.keywords,
    row?.category,
    row?.material,
    row?.calculation_basis,
    row?.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("electricity") || text.includes("kwh") || text.includes("tnb")) {
    return "manual-malaysia-electricity";
  }

  if (text.includes("diesel")) return "manual-malaysia-diesel";
  if (text.includes("petrol") || text.includes("gasoline")) return "manual-malaysia-petrol";
  if (text.includes("natural gas")) return "manual-malaysia-natural-gas";
  if (text.includes("lpg")) return "manual-malaysia-lpg";

  return null;
}

function getFactor(row: any): number {
  const value =
    row?.fallback_factor_kgco2e_per_unit ??
    row?.emission_factor ??
    row?.factor ??
    row?.factor_value ??
    row?.co2e_factor ??
    0;

  return Number(value || 0);
}

function getFallbackUnit(row: any): string | null {
  return (
    row?.fallback_unit ||
    row?.ef_unit ||
    row?.factor_unit ||
    row?.unit ||
    null
  );
}

function getRegion(row: any, defaultRegion?: string | null): string | null {
  return (
    row?.climatiq_region ||
    row?.requested_region ||
    row?.region ||
    defaultRegion ||
    null
  );
}

function getUnitType(row: any): string | null {
  return (
    row?.unit_type ||
    row?.parameter_name ||
    row?.input_unit ||
    row?.unit ||
    null
  );
}

function rowText(row: any): string {
  return [
    row?.pattern,
    row?.item_keywords,
    row?.keyword,
    row?.keywords,
    row?.category,
    row?.material,
    row?.calculation_basis,
    row?.notes,
    row?.activity,
    row?.sector,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function keywordMatchScore(itemName: string, row: any): number {
  const item = String(itemName || "").toLowerCase();
  const text = rowText(row);

  if (!text) return 0;

  let score = 0;

  const strongSignals = [
    "electricity",
    "kwh",
    "tnb",
    "tenaga",
    "diesel",
    "petrol",
    "gasoline",
    "natural gas",
    "lpg",
    "campus",
    "university",
    "bank",
    "warehouse",
    "export",
    "freight",
  ];

  for (const signal of strongSignals) {
    if (item.includes(signal) && text.includes(signal)) {
      score += 20;
    }
  }

  const tokens = item
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length >= 3 && !["the", "and", "for", "with"].includes(token));

  for (const token of tokens) {
    if (text.includes(token)) score += 3;
  }

  const priority = Number(row?.priority || 0);
  score += Math.min(priority, 100) / 100;

  return score;
}

export async function findBestMapping(
  itemName: string,
  country: string = "Malaysia",
  region?: string
): Promise<EmissionFactorMapping | null> {
  const cleanItemName = String(itemName || "").trim();
  const cleanCountry = String(country || "Malaysia").trim();
  const cleanRegion = region ? String(region).trim() : null;

  if (!cleanItemName) return null;

  const columns = await getMappingColumns();

  const whereParts: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Add country filter only when the connected DB actually has country column.
  if (hasColumn(columns, "country")) {
    whereParts.push(`country = $${paramIndex}`);
    params.push(cleanCountry);
    paramIndex += 1;
  }

  // Add active filter only when the connected DB actually has active column.
  if (hasColumn(columns, "active")) {
    whereParts.push(`active = true`);
  }

  // Add region filter only when region column exists.
  if (hasColumn(columns, "region") && cleanRegion) {
    whereParts.push(`(region = $${paramIndex} OR region = 'Malaysia' OR region IS NULL)`);
    params.push(cleanRegion);
    paramIndex += 1;
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const orderBy = hasColumn(columns, "priority")
    ? `ORDER BY priority DESC NULLS LAST`
    : "";

  const result = await db.query(
    `
    SELECT *
    FROM ${quoteIdent(TABLE_SCHEMA)}.${quoteIdent(TABLE_NAME)}
    ${whereClause}
    ${orderBy}
    LIMIT 500
    `,
    params
  );

  const rows = result.rows || [];

  if (rows.length === 0) return null;

  let bestRow: any = null;
  let bestScore = -1;

  for (const row of rows) {
    let score = keywordMatchScore(cleanItemName, row);

    // If table has pattern column, use regex safely in JS, not SQL.
    // This prevents SQL errors when pattern column is missing.
    if (row?.pattern) {
      try {
        const regex = new RegExp(String(row.pattern), "i");
        if (regex.test(cleanItemName)) score += 1000;
      } catch {
        // Ignore invalid DB regex pattern and continue with keyword score.
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  }

  if (!bestRow || bestScore <= 0) {
    return null;
  }

  const requestedRegion = getRegion(bestRow, cleanRegion || (cleanCountry.toLowerCase() === "malaysia" ? "MY" : cleanCountry));
  const unitType = getUnitType(bestRow);

  return {
    ...bestRow,

    // Normalize/fill old app.ts compatibility fields
    country: bestRow.country || cleanCountry,
    region: bestRow.region || requestedRegion,

    fallback_factor_kgco2e_per_unit: getFactor(bestRow),
    fallback_unit: getFallbackUnit(bestRow),

    activity_id:
      bestRow.activity_id ||
      bestRow.climatiq_activity_id ||
      buildManualActivityId(bestRow),

    requested_region: requestedRegion,
    parameter_name: mapUnitTypeToParameterName(unitType),
    data_version: bestRow.data_version || "^6",
  };
}

export function calculateEmission(
  quantity: number,
  mapping: EmissionFactorMapping
) {
  const factor = getFactor(mapping);
  const safeQuantity = Number(quantity || 0);

  const totalKgCO2e = safeQuantity * factor;
  const totalTCO2e = totalKgCO2e / 1000;

  return {
    emission_factor: factor,
    factor_unit: getFallbackUnit(mapping),
    total_kgco2e: Number(totalKgCO2e.toFixed(6)),
    total_tco2e: Number(totalTCO2e.toFixed(6)),
    material: mapping.material || null,
    category: mapping.category || null,
    region: mapping.region || mapping.requested_region || null,
    source: mapping.notes || null,
  };
}
