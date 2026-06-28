export function normalizeUnit(unit?: string | null): string {
  if (!unit) return "";

  const u = String(unit).toLowerCase().trim();

  const unitMap: Record<string, string> = {
    "kilowatt hour": "kwh",
    "kilowatt-hour": "kwh",
    "kwhr": "kwh",
    "kwj": "kwh",
    "kwh": "kwh",
    "mwh": "mwh",

    "litre": "l",
    "liter": "l",
    "litres": "l",
    "liters": "l",
    "ltr": "l",
    "l": "l",
    "ml": "ml",

    "kilogram": "kg",
    "kilograms": "kg",
    "kgs": "kg",
    "kg": "kg",
    "g": "g",

    "ton": "t",
    "tons": "t",
    "tonne": "t",
    "tonnes": "t",
    "mt": "t",

    "cubic meter": "m3",
    "cubic metre": "m3",
    "m³": "m3",
    "m3": "m3",

    "meter": "m",
    "metre": "m",
    "meters": "m",
    "metres": "m",
    "m": "m",

    "kilometer": "km",
    "kilometre": "km",
    "kilometers": "km",
    "kilometres": "km",
    "kms": "km",
    "km": "km",

    "piece": "pcs",
    "pieces": "pcs",
    "pcs": "pcs",
    "nos": "pcs",
    "unit": "pcs",
    "units": "pcs"
  };

  return unitMap[u] || u;
}

export function convertToTargetUnit(
  value: number,
  fromUnit: string,
  targetUnit: string
) {
  if (!value || Number.isNaN(value)) {
    throw new Error("Invalid quantity value");
  }

  const from = normalizeUnit(fromUnit);
  const target = normalizeUnit(targetUnit);

  if (!from) {
    throw new Error("Source unit missing");
  }

  if (!target) {
    throw new Error("Target unit missing");
  }

  if (from === target) {
    return {
      value,
      unit: targetUnit
    };
  }

  if (from === "t" && target === "kg") {
    return { value: value * 1000, unit: "kg" };
  }

  if (from === "kg" && target === "t") {
    return { value: value / 1000, unit: "t" };
  }

  if (from === "g" && target === "kg") {
    return { value: value / 1000, unit: "kg" };
  }

  if (from === "ml" && target === "l") {
    return { value: value / 1000, unit: "l" };
  }

  if (from === "mwh" && target === "kwh") {
    return { value: value * 1000, unit: "kWh" };
  }

  if (from === "m" && target === "km") {
    return { value: value / 1000, unit: "km" };
  }

  if (from === "km" && target === "m") {
    return { value: value * 1000, unit: "m" };
  }

  throw new Error(`Unsupported unit conversion from ${fromUnit} to ${targetUnit}`);
}
