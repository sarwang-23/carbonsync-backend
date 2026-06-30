export type ExtractedQuantity = {
  value: number | null;
  unit: string | null;
};

export function extractQuantityFromText(text: string): ExtractedQuantity {
  const patterns = [
    {
      regex: /([\d,.]+)\s*(kwh|kwj|kilowatt[-\s]?hour)/i,
      unit: "kWh",
    },
    {
      regex: /([\d,.]+)\s*(passenger[-\s]?km|pkm)/i,
      unit: "passenger-km",
    },
    {
      regex: /([\d,.]+)\s*(km|kilometre|kilometer|kms)\b/i,
      unit: "km",
    },
    {
      regex: /([\d,.]+)\s*(m3|m³|cubic metre|cubic meter)/i,
      unit: "m3",
    },
    {
      regex: /([\d,.]+)\s*(kl|kilolitre|kiloliter)/i,
      unit: "kL",
    },
    {
      regex: /([\d,.]+)\s*(tonne|tonnes|tons|t)/i,
      unit: "tonne",
    },
    {
      regex: /([\d,.]+)\s*(litre|liter|litres|liters|l)\b/i,
      unit: "litre",
    },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);

    if (match?.[1]) {
      const value = Number(match[1].replace(/,/g, ""));

      if (Number.isFinite(value)) {
        return {
          value,
          unit: pattern.unit,
        };
      }
    }
  }

  return {
    value: null,
    unit: null,
  };
}
