export function normalizeUnit(unit?: string | null): string {
  if (!unit) return "";

  const u = String(unit)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-_.]/g, "");

  const unitMap: Record<string, string> = {
    // electricity
    "kilowatthour": "kwh",
    "kwhr": "kwh",
    "kwj": "kwh",
    "kwh": "kwh",
    "mwh": "mwh",

    // volume (L)
    "litre": "l",
    "liter": "l",
    "litres": "l",
    "liters": "l",
    "ltr": "l",
    "l": "l",
    "ml": "ml",
    "kl": "kl",

    // mass
    "kilogram": "kg",
    "kilograms": "kg",
    "kgs": "kg",
    "kg": "kg",
    "g": "g",
    
    "ton": "tonne",
    "tons": "tonne",
    "tonne": "tonne",
    "tonnes": "tonne",
    "mt": "tonne",
    "m/t": "tonne",
    "metricton": "tonne",
    "metrictonne": "tonne",
    "t": "tonne",

    // volume (m3, etc)
    "cubicmeter": "m3",
    "cubicmetre": "m3",
    "m³": "m3",
    "m3": "m3",
    "scf": "scf",

    // energy
    "gj": "gj",
    "mj": "mj",

    // distance
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

    // freight/transport
    "tonnekm": "tonnekm",
    "passengerkm": "passengerkm",

    // emission factor
    "kgco2e/kwh": "kgco2e/kwh",
    "kg/kwh": "kgco2e/kwh",

    // quantity
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

  if (from === "tonne" && target === "kg") {
    return { value: value * 1000, unit: "kg" };
  }

  if (from === "kg" && target === "tonne") {
    return { value: value / 1000, unit: "tonne" };
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

export type ConversionInput = {
  region: string;
  category: string;
  value: number;
  unit: string;
};

export function convertToExpectedUnit(input: ConversionInput) {
  const unit = (input.unit || "").toLowerCase().trim();

  // Already kWh
  if (unit === "kwh" || unit === "kwj") {
    return {
      value: input.value,
      unit: "kWh",
      converted: false,
    };
  }

  // Germany natural gas: rough conversion m3 → kWh
  // 1 m3 natural gas approx 10.55 kWh
  if (
    input.region === "DE" &&
    input.category === "natural_gas" &&
    (unit === "m3" || unit === "m³")
  ) {
    return {
      value: Number((input.value * 10.55).toFixed(6)),
      unit: "kWh",
      converted: true,
      conversion_note: "Converted natural gas from m3 to kWh using approx 10.55 kWh/m3",
    };
  }

  // Germany diesel/heating oil: rough conversion litre → kWh
  // 1 litre heating oil/diesel approx 10 kWh
  if (
    input.region === "DE" &&
    input.category === "diesel" &&
    (unit === "l" || unit === "litre" || unit === "liter")
  ) {
    return {
      value: Number((input.value * 10).toFixed(6)),
      unit: "kWh",
      converted: true,
      conversion_note: "Converted diesel/heating oil from litre to kWh using approx 10 kWh/litre",
    };
  }

  return {
    value: input.value,
    unit: input.unit,
    converted: false,
  };
}

