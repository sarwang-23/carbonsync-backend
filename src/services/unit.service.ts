export function convertQuantity(quantity: number, unit: string) {
  const normalizedUnit = unit.toLowerCase();

  if (["mt", "ton", "tons", "tonne", "tonnes"].includes(normalizedUnit)) {
    return {
      value: quantity * 1000,
      unit: "kg",
    };
  }

  if (["kg", "kgs"].includes(normalizedUnit)) {
    return {
      value: quantity,
      unit: "kg",
    };
  }

  if (["kwh"].includes(normalizedUnit)) {
    return {
      value: quantity,
      unit: "kWh",
    };
  }

  if (["km"].includes(normalizedUnit)) {
    return {
      value: quantity,
      unit: "km",
    };
  }

  return {
    value: quantity,
    unit,
  };
}