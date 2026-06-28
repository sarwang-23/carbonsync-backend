export function fillNullValues(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(fillNullValues);
  }

  if (obj && typeof obj === "object") {
    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        result[key] = getDefaultValueForKey(key);
      } else {
        result[key] = fillNullValues(value);
      }
    }

    return result;
  }

  return obj;
}

function getDefaultValueForKey(key: string): any {
  const lowerKey = key.toLowerCase();

  if (lowerKey.includes("date")) return "not_available";
  if (lowerKey.includes("year")) return "not_available";
  if (lowerKey.includes("factor") && !lowerKey.includes("factorunit") && !lowerKey.includes("factoryear") && !lowerKey.includes("factorid") && lowerKey !== "rawfactor") return "calculated_from_result";
  if (lowerKey.includes("uncertainty")) return "not_reported_by_source";

  if (
    lowerKey === "co2" ||
    lowerKey === "ch4" ||
    lowerKey === "n2o" ||
    lowerKey === "ch4_fossil" ||
    lowerKey === "ch4_biogenic" ||
    lowerKey === "co2e_other"
  ) {
    return "not_reported_by_source";
  }

  return "not_available";
}
