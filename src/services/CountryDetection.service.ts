export type DetectedCountry = {
  region: string;
  country_name: string;
  currency: string;
};

/**
 * Detects invoice country from raw extracted text.
 * Order matters: Germany before France (both use EUR).
 * Malaysia is final fallback (existing default).
 */
export function detectCountryFromText(text: string): DetectedCountry {
  const lower = text.toLowerCase();

  // Germany — before France since both use EUR
  const hasGermanyKeyword =
    lower.includes("germany") ||
    lower.includes("deutschland") ||
    lower.includes("strom") ||
    lower.includes("stromrechnung") ||
    lower.includes("erdgas") ||
    lower.includes("gasrechnung") ||
    lower.includes("fernwärme") ||
    lower.includes("heizöl") ||
    lower.includes("ust-idnr") ||
    lower.includes("steuer-nr");

  if (hasGermanyKeyword) {
    return { region: "DE", country_name: "Germany", currency: "EUR" };
  }

  // France
  const hasFranceKeyword =
    lower.includes("france") ||
    lower.includes("république française") ||
    lower.includes("edf") ||
    lower.includes("enedis") ||
    lower.includes("siret") ||
    lower.includes("tva");

  if (hasFranceKeyword) {
    return { region: "FR", country_name: "France", currency: "EUR" };
  }

  // United Kingdom
  const hasUKKeyword =
    lower.includes("united kingdom") ||
    lower.includes("great britain") ||
    lower.includes("gbp") ||
    lower.includes("£") ||
    lower.includes("british gas") ||
    lower.includes("octopus energy") ||
    lower.includes("edf energy") ||
    lower.includes("scottish power");

  if (hasUKKeyword) {
    return { region: "GB", country_name: "United Kingdom", currency: "GBP" };
  }

  // Australia
  const hasAustraliaKeyword =
    lower.includes("australia") ||
    lower.includes("aud") ||
    lower.includes("agl") ||
    lower.includes("origin energy") ||
    lower.includes("energy australia") ||
    lower.includes("nsw") ||
    lower.includes("victoria") ||
    lower.includes("queensland");

  if (hasAustraliaKeyword) {
    return { region: "AU", country_name: "Australia", currency: "AUD" };
  }

  // United States
  const hasUSKeyword =
    lower.includes("united states") ||
    lower.includes("usa") ||
    lower.includes("usd") ||
    lower.includes("epa") ||
    lower.includes("gallon") ||
    lower.includes("therm");

  if (hasUSKeyword) {
    return { region: "US", country_name: "United States", currency: "USD" };
  }

  // Malaysia
  const hasMalaysiaKeyword =
    lower.includes("malaysia") ||
    lower.includes("myr") ||
    lower.includes("tenaga nasional") ||
    lower.includes("tnb") ||
    lower.includes("kwj") ||
    lower.includes("rm ");

  if (hasMalaysiaKeyword) {
    return { region: "MY", country_name: "Malaysia", currency: "MYR" };
  }

  // India
  const hasIndiaKeyword =
    lower.includes("india") ||
    lower.includes("inr") ||
    lower.includes("adani") ||
    lower.includes("tata power") ||
    lower.includes("₹");

  if (hasIndiaKeyword) {
    return { region: "IN", country_name: "India", currency: "INR" };
  }

  // Default fallback — existing Malaysia logic
  return { region: "MY", country_name: "Malaysia", currency: "MYR" };
}
