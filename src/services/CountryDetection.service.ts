export type DetectedCountry = {
  region: string;
  country_name: string;
  currency: string;
  confidence: number;
  reason: string;
};

function normalizeText(input: string) {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectCountryFromText(text: string, fileName = ""): DetectedCountry | null {
  const lower = normalizeText(`${fileName} ${text}`);

  // 1. Explicit region code - strongest signal
  if (
    lower.includes("region code: in") ||
    lower.includes("region: in") ||
    lower.includes("country_name=india") ||
    lower.includes("region=in")
  ) {
    return {
      region: "IN",
      country_name: "India",
      currency: "INR",
      confidence: 100,
      reason: "Explicit region code IN found",
    };
  }

  if (
    lower.includes("region code: my") ||
    lower.includes("region: my") ||
    lower.includes("country_name=malaysia") ||
    lower.includes("region=my")
  ) {
    return {
      region: "MY",
      country_name: "Malaysia",
      currency: "MYR",
      confidence: 100,
      reason: "Explicit region code MY found",
    };
  }

  if (
    lower.includes("region code: de") ||
    lower.includes("region: de") ||
    lower.includes("country_name=germany") ||
    lower.includes("region=de")
  ) {
    return {
      region: "DE",
      country_name: "Germany",
      currency: "EUR",
      confidence: 100,
      reason: "Explicit region code DE found",
    };
  }

  if (
    lower.includes("region code: gb") ||
    lower.includes("region: gb") ||
    lower.includes("country_name=united kingdom") ||
    lower.includes("region=gb")
  ) {
    return {
      region: "GB",
      country_name: "United Kingdom",
      currency: "GBP",
      confidence: 100,
      reason: "Explicit region code GB found",
    };
  }

  if (
    lower.includes("region code: au") ||
    lower.includes("region: au") ||
    lower.includes("country_name=australia") ||
    lower.includes("region=au")
  ) {
    return {
      region: "AU",
      country_name: "Australia",
      currency: "AUD",
      confidence: 100,
      reason: "Explicit region code AU found",
    };
  }

  if (
    lower.includes("region code: fr") ||
    lower.includes("region: fr") ||
    lower.includes("country_name=france") ||
    lower.includes("region=fr")
  ) {
    return {
      region: "FR",
      country_name: "France",
      currency: "EUR",
      confidence: 100,
      reason: "Explicit region code FR found",
    };
  }

  if (
    lower.includes("region code: us") ||
    lower.includes("region: us") ||
    lower.includes("country_name=united states") ||
    lower.includes("region=us")
  ) {
    return {
      region: "US",
      country_name: "United States",
      currency: "USD",
      confidence: 100,
      reason: "Explicit region code US found",
    };
  }

  // 2. Vendor/country keywords
  if (
    lower.includes("tenaga nasional") ||
    lower.includes("tnb") ||
    lower.includes("malaysia") ||
    lower.includes("myr") ||
    lower.includes("kwj")
  ) {
    return {
      region: "MY",
      country_name: "Malaysia",
      currency: "MYR",
      confidence: 95,
      reason: "Malaysia/TNB/MYR keyword found",
    };
  }

  if (
    lower.includes("dhbvn") ||
    lower.includes("uppcl") ||
    lower.includes("bses") ||
    lower.includes("tata power") ||
    lower.includes("adani electricity") ||
    lower.includes("gstin") ||
    lower.includes("india") ||
    lower.includes("inr") ||
    lower.includes("₹")
  ) {
    return {
      region: "IN",
      country_name: "India",
      currency: "INR",
      confidence: 95,
      reason: "India/INR/GSTIN/utility keyword found",
    };
  }

  if (
    lower.includes("strom") ||
    lower.includes("stromrechnung") ||
    lower.includes("deutschland") ||
    lower.includes("germany") ||
    lower.includes("ust-idnr") ||
    lower.includes("steuer-nr")
  ) {
    return {
      region: "DE",
      country_name: "Germany",
      currency: "EUR",
      confidence: 95,
      reason: "Germany keyword found",
    };
  }

  if (
    lower.includes("united kingdom") ||
    lower.includes("great britain") ||
    lower.includes("british gas") ||
    lower.includes("gbp") ||
    lower.includes("uk energy")
  ) {
    return {
      region: "GB",
      country_name: "United Kingdom",
      currency: "GBP",
      confidence: 95,
      reason: "UK keyword found",
    };
  }

  if (
    lower.includes("australia") ||
    lower.includes("aud") ||
    lower.includes("energy australia") ||
    lower.includes("victoria") ||
    lower.includes("nsw") ||
    lower.includes("queensland")
  ) {
    return {
      region: "AU",
      country_name: "Australia",
      currency: "AUD",
      confidence: 95,
      reason: "Australia keyword found",
    };
  }

  if (
    lower.includes("france") ||
    lower.includes("edf") ||
    lower.includes("enedis") ||
    lower.includes("siret") ||
    lower.includes("facture electricite")
  ) {
    return {
      region: "FR",
      country_name: "France",
      currency: "EUR",
      confidence: 95,
      reason: "France keyword found",
    };
  }

  if (
    lower.includes("united states") ||
    lower.includes("usa") ||
    lower.includes("usd") ||
    lower.includes("us electric") ||
    lower.includes("utility bill")
  ) {
    return {
      region: "US",
      country_name: "United States",
      currency: "USD",
      confidence: 90,
      reason: "US keyword found",
    };
  }

  return null;
}
