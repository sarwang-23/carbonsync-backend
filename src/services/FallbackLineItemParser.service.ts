export type ParsedFallbackItem = {
  item_name: string;
  category: string;
  value: number;
  unit: string;
};

function detectCategory(line: string): string {
  const lower = line.toLowerCase();

  if (
    lower.includes("electricity") ||
    lower.includes("power bill") ||
    lower.includes("kwh") ||
    lower.includes("kwj")
  ) return "electricity";

  if (
    lower.includes("railway") ||
    lower.includes("train") ||
    lower.includes("passenger-km") ||
    lower.includes("passenger km") ||
    lower.includes("pkm")
  ) return "railway";

  if (
    lower.includes("flight") ||
    lower.includes("airline") ||
    lower.includes("airport") ||
    lower.includes("km travel")
  ) return "flight";

  if (
    lower.includes("steel") ||
    lower.includes("tmt") ||
    lower.includes("iron")
  ) return "steel";

  if (
    lower.includes("aluminium") ||
    lower.includes("aluminum")
  ) return "aluminium";

  if (
    lower.includes("textile") ||
    lower.includes("fabric") ||
    lower.includes("cotton")
  ) return "textile";

  if (
    lower.includes("diesel") ||
    lower.includes("fuel")
  ) return "diesel";

  return "unknown";
}

export function parseFallbackLineItems(text: string): ParsedFallbackItem[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items: ParsedFallbackItem[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();

    // electricity: 18500 kWh / 1,000 kWh
    const electricityMatch = line.match(/(.{0,80}?)([\d,]+(?:\.\d+)?)\s*(kwh|kwj)\b/i);
    if (electricityMatch && lower.includes("electricity")) {
      items.push({
        item_name: line,
        category: "electricity",
        value: Number(electricityMatch[2].replace(/,/g, "")),
        unit: "kWh",
      });
      continue;
    }

    // passenger-km
    const passengerKmMatch = line.match(/(.{0,80}?)([\d,]+(?:\.\d+)?)\s*(passenger-km|passenger km|pkm)\b/i);
    if (passengerKmMatch) {
      items.push({
        item_name: line,
        category: "railway",
        value: Number(passengerKmMatch[2].replace(/,/g, "")),
        unit: "passenger-km",
      });
      continue;
    }

    // kg based items
    const kgMatch = line.match(/(.{0,100}?)([\d,]+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms)\b/i);
    if (kgMatch) {
      const category = detectCategory(line);
      if (category !== "unknown") {
        items.push({
          item_name: line,
          category,
          value: Number(kgMatch[2].replace(/,/g, "")),
          unit: "kg",
        });
      }
      continue;
    }

    // km based transport/flight
    const kmMatch = line.match(/(.{0,100}?)([\d,]+(?:\.\d+)?)\s*(km|kms|kilometer|kilometre)\b/i);
    if (kmMatch) {
      const category = detectCategory(line);
      if (category !== "unknown") {
        items.push({
          item_name: line,
          category,
          value: Number(kmMatch[2].replace(/,/g, "")),
          unit: "km",
        });
      }
    }
  }

  // duplicate remove
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.category}-${item.value}-${item.unit}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
