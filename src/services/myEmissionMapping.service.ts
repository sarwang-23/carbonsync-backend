import { supabase } from "../lib/supabase.js";
import type { NormalizedInvoiceItem } from "../types/invoice.types.js";

export type EmissionMapping = {
  id: string;
  region: string;
  category: string;
  subcategory?: string;
  keywords: string[];
  activity_id: string;
  parameter_name: string;
  parameter_unit: string;
  unit_type?: string;
  data_version: string;
  priority: number;
  confidence_score: number;
};

export type MappingResult = {
  matched: boolean;
  confidence: number;
  reason: string;
  mapping?: EmissionMapping;
  normalizedItemName: string;
  suggestedCategory?: string;
};

export function normalizeText(input: string = ""): string {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUnit(unit?: string | null): string {
  if (!unit) return "";

  const u = String(unit).toLowerCase().trim();

  const unitMap: Record<string, string> = {
    "kilowatt hour": "kwh",
    "kilowatt-hour": "kwh",
    "kwhr": "kwh",
    "kwj": "kwh",
    "kwh": "kwh",

    "litre": "l",
    "liter": "l",
    "litres": "l",
    "liters": "l",
    "ltr": "l",
    "l": "l",

    "kilogram": "kg",
    "kilograms": "kg",
    "kgs": "kg",
    "kg": "kg",

    "ton": "t",
    "tons": "t",
    "tonne": "t",
    "tonnes": "t",
    "mt": "t",

    "cubic meter": "m3",
    "cubic metre": "m3",
    "m³": "m3",
    "m3": "m3",

    "kilometer": "km",
    "kilometre": "km",
    "kilometers": "km",
    "kilometres": "km",
    "kms": "km",
    "km": "km",

    "pcs": "pcs",
    "piece": "pcs",
    "pieces": "pcs",
    "nos": "pcs",
    "units": "pcs"
  };

  return unitMap[u] || u;
}

function getKeywordScore(text: string, keywords: string[]) {
  let score = 0;
  const matchedKeywords: string[] = [];

  for (const keyword of keywords || []) {
    const k = normalizeText(keyword);
    if (!k) continue;

    if (text === k) {
      score += 1.0;
      matchedKeywords.push(keyword);
    } else if (text.includes(k)) {
      score += 0.65;
      matchedKeywords.push(keyword);
    } else {
      const words = k.split(" ").filter(Boolean);
      const matchedWords = words.filter((word) => text.includes(word));

      if (words.length > 1 && matchedWords.length > 0) {
        score += (matchedWords.length / words.length) * 0.30;
      }
    }
  }

  return {
    score,
    matchedKeywords
  };
}

function getUnitBoost(itemUnit: string, mappingUnit: string): number {
  const u1 = normalizeUnit(itemUnit);
  const u2 = normalizeUnit(mappingUnit);

  if (!u1 || !u2) return 0;

  if (u1 === u2) return 0.25;

  if (u1 === "t" && u2 === "kg") return 0.15;
  if (u1 === "kg" && u2 === "t") return 0.15;
  if (u1 === "mwh" && u2 === "kwh") return 0.15;

  return 0;
}

function suggestCategory(text: string, unit?: string | null): string {
  const u = normalizeUnit(unit);

  if (
    text.includes("tnb") ||
    text.includes("tenaga") ||
    text.includes("electric") ||
    text.includes("kwh") ||
    u === "kwh"
  ) {
    return "electricity";
  }

  if (text.includes("diesel")) return "diesel";

  if (
    text.includes("petrol") ||
    text.includes("gasoline") ||
    text.includes("ron95") ||
    text.includes("ron97")
  ) {
    return "petrol";
  }

  if (text.includes("natural gas") || text.includes("lng")) {
    return "natural_gas";
  }

  if (text.includes("water") || text.includes("air selangor") || u === "m3") {
    return "water";
  }

  if (
    text.includes("freight") ||
    text.includes("shipping") ||
    text.includes("logistics") ||
    text.includes("delivery") ||
    text.includes("haulage")
  ) {
    return "freight";
  }

  if (
    text.includes("timber") ||
    text.includes("wood") ||
    text.includes("plywood") ||
    text.includes("flush door")
  ) {
    return "timber";
  }

  if (text.includes("steel") || text.includes("iron") || text.includes("rebar")) {
    return "steel";
  }

  if (text.includes("aluminium") || text.includes("aluminum")) {
    return "aluminium";
  }

  if (
    text.includes("textile") ||
    text.includes("fabric") ||
    text.includes("cotton") ||
    text.includes("polyester")
  ) {
    return "textile";
  }

  if (u === "kg" || u === "t") return "material";
  if (u === "km") return "transport";

  return "unknown_review";
}

export async function findEmissionMappingForItem(
  item: NormalizedInvoiceItem,
  region = "MY"
): Promise<MappingResult> {
  const normalizedItemName = normalizeText(
    [
      item.name,
      item.description,
      item.unit
    ]
      .filter(Boolean)
      .join(" ")
  );

  const { data, error } = await supabase
    .from("emission_factor_mappings")
    .select("*")
    .eq("region", region)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (error) {
    return {
      matched: false,
      confidence: 0,
      reason: `Mapping DB error: ${error.message}`,
      normalizedItemName,
      suggestedCategory: suggestCategory(normalizedItemName, item.unit)
    };
  }

  const mappings = (data || []) as EmissionMapping[];

  let bestMapping: EmissionMapping | undefined;
  let bestScore = 0;
  let bestReason = "No match";

  for (const mapping of mappings) {
    const keywordResult = getKeywordScore(normalizedItemName, mapping.keywords);
    const unitBoost = getUnitBoost(item.unit || "", mapping.parameter_unit);
    const priorityBoost = mapping.priority <= 10 ? 0.1 : 0;

    const finalScore = keywordResult.score + unitBoost + priorityBoost;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestMapping = mapping;
      bestReason = `Matched keywords: ${
        keywordResult.matchedKeywords.join(", ") || "none"
      }, unit boost: ${unitBoost}`;
    }
  }

  if (bestMapping && bestScore >= 0.55) {
    return {
      matched: true,
      confidence: Math.min(1, Number(bestScore.toFixed(2))),
      reason: bestReason,
      mapping: bestMapping,
      normalizedItemName,
      suggestedCategory: bestMapping.category
    };
  }

  return {
    matched: false,
    confidence: Number(bestScore.toFixed(2)),
    reason: "No reliable mapping found",
    normalizedItemName,
    suggestedCategory: suggestCategory(normalizedItemName, item.unit)
  };
}
