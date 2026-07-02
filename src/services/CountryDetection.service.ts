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
  const fnLower = String(fileName).trim().toLowerCase();

  // 1. Explicit Filename Prefix Check (Highest Priority)
  if (fnLower.startsWith("de_")) return { region: "DE", country_name: "Germany", currency: "EUR", confidence: 100, reason: "Filename prefix DE_ found" };
  if (fnLower.startsWith("fr_")) return { region: "FR", country_name: "France", currency: "EUR", confidence: 100, reason: "Filename prefix FR_ found" };
  if (fnLower.startsWith("my_")) return { region: "MY", country_name: "Malaysia", currency: "MYR", confidence: 100, reason: "Filename prefix MY_ found" };
  if (fnLower.startsWith("in_")) return { region: "IN", country_name: "India", currency: "INR", confidence: 100, reason: "Filename prefix IN_ found" };
  if (fnLower.startsWith("us_")) return { region: "US", country_name: "United States", currency: "USD", confidence: 100, reason: "Filename prefix US_ found" };
  if (fnLower.startsWith("gb_") || fnLower.startsWith("uk_")) return { region: "GB", country_name: "United Kingdom", currency: "GBP", confidence: 100, reason: "Filename prefix GB_ found" };
  if (fnLower.startsWith("au_")) return { region: "AU", country_name: "Australia", currency: "AUD", confidence: 100, reason: "Filename prefix AU_ found" };

  // 2. Explicit region code - strongest signal
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

  // 2. Australian Vendors & Keywords
  if (
    lower.includes("origin energy") ||
    lower.includes("agl") ||
    lower.includes("energyaustralia") ||
    lower.includes("red energy") ||
    lower.includes("alinta") ||
    lower.includes("synergy") ||
    lower.includes("aurora") ||
    lower.includes("actewagl") ||
    lower.includes("jemena") ||
    lower.includes("ausgrid") ||
    lower.includes("australia") ||
    lower.includes("new south wales") ||
    lower.includes("victoria") ||
    lower.includes("queensland") ||
    lower.includes("tasmania") ||
    lower.includes("western australia") ||
    lower.includes("south australia") ||
    lower.includes("northern territory") ||
    lower.includes("australian capital territory") ||
    lower.includes("australian capital territory") ||
    /(^|\W)aud(?=\W|$)/.test(lower)
  ) {
    return {
      region: "AU",
      country_name: "Australia",
      currency: "AUD",
      confidence: 95,
      reason: "Australia keyword found",
    };
  }

  // 3. Malaysia
  if (
    lower.includes("tenaga nasional") ||
    lower.includes("tnb") ||
    lower.includes("malaysia") ||
    lower.includes("region code: my")
  ) {
    return {
      region: "MY",
      country_name: "Malaysia",
      currency: "MYR",
      confidence: 95,
      reason: "Malaysia/TNB keyword found",
    };
  }

  // 4. Germany
  if (
    lower.includes("strom") ||
    lower.includes("netzstrom") ||
    lower.includes("stromrechnung") ||
    lower.includes("deutschland") ||
    lower.includes("germany") ||
    lower.includes("ust-idnr") ||
    lower.includes("steuer-nr") ||
    lower.includes("erdgas") ||
    lower.includes("gasrechnung") ||
    lower.includes("fernwärme") ||
    lower.includes("fernwaerme") ||
    /(^|\W)gmbh(?=\W|$)/.test(lower) ||
    lower.includes("stadtwerke") ||
    lower.includes("energie") ||
    /(^|\W)(eur|€)(?=\W|$)/.test(lower)
  ) {
    return {
      region: "DE",
      country_name: "Germany",
      currency: "EUR",
      confidence: 95,
      reason: "Germany keyword found",
    };
  }

  // 5. United Kingdom
  if (
    lower.includes("united kingdom") ||
    lower.includes("great britain") ||
    lower.includes("british gas") ||
    /(^|\W)(gbp|£)(?=\W|$)/.test(lower) ||
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

  // 6. France
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

  // 7. United States
  if (
    lower.includes("united states") ||
    /(^|\W)usa(?=\W|$)/.test(lower) ||
    /(^|\W)usd(?=\W|$)/.test(lower) ||
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

  // 8. India (Lowest Priority)
  if (
    lower.includes("tata power") ||
    lower.includes("bses") ||
    lower.includes("adani electricity") ||
    lower.includes("msedcl") ||
    lower.includes("uppcl") ||
    lower.includes("nbpdcl") ||
    lower.includes("sbpdcl") ||
    lower.includes("bescom") ||
    lower.includes("tangedco") ||
    lower.includes("torrent power") ||
    lower.includes("tpddl") ||
    lower.includes("kseb") ||
    lower.includes("irctc") ||
    lower.includes("indian railways") ||
    lower.includes("indigo") ||
    lower.includes("air india") ||
    lower.includes("vistara") ||
    lower.includes("akasa") ||
    lower.includes("spicejet") ||
    lower.includes("india") ||
    lower.includes("inr") ||
    lower.includes("₹")
  ) {
    return {
      region: "IN",
      country_name: "India",
      currency: "INR",
      confidence: 95,
      reason: "India electricity utility keyword found",
    };
  }

  return null;
}
