/**
 * Detects emission category from an invoice item description.
 * Returns a canonical category string compatible with emission_factor_mappings.
 */
export function detectCategoryFromText(text: string): string {
  const lower = text.toLowerCase();

  if (
    lower.includes("electricity") ||
    lower.includes("power bill") ||
    lower.includes("grid electricity") ||
    lower.includes("kwh") ||
    lower.includes("kwj") ||
    lower.includes("strom") ||
    lower.includes("stromrechnung") ||
    lower.includes("netzstrom")
  ) {
    return "electricity";
  }

  if (
    lower.includes("natural gas") ||
    lower.includes("gas bill") ||
    lower.includes("erdgas") ||
    lower.includes("gasrechnung") ||
    lower.includes("pipeline gas")
  ) {
    return "natural_gas";
  }

  if (
    lower.includes("diesel") ||
    lower.includes("heating oil") ||
    lower.includes("heizöl") ||
    lower.includes("fuel oil") ||
    lower.includes("ado")
  ) {
    return "diesel";
  }

  if (
    lower.includes("petrol") ||
    lower.includes("gasoline") ||
    lower.includes("motor spirit") ||
    lower.includes("ulp")
  ) {
    return "petrol";
  }

  if (
    lower.includes("district heating") ||
    lower.includes("fernwärme") ||
    lower.includes("wärme")
  ) {
    return "district_heating";
  }

  if (
    lower.includes("coal") ||
    lower.includes("lignite") ||
    lower.includes("coking coal") ||
    lower.includes("bituminous coal")
  ) {
    return "coal";
  }

  if (
    lower.includes("waste") ||
    lower.includes("landfill") ||
    lower.includes("municipal waste")
  ) {
    return "waste";
  }

  return "unknown";
}
