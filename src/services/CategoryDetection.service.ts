export function detectCategoryFromText(text: string): string {
  const lower = text.toLowerCase();

  // ── District Heating ────────────────────────────────────────────────────────
  if (
    lower.includes("fernwärme") ||
    lower.includes("fernwaerme") ||
    lower.includes("district heating") ||
    lower.includes("heat supply") ||
    lower.includes("wärmenetz") ||
    lower.includes("heating network") ||
    lower.includes("heating energy") ||
    lower.includes("district cooling")
  ) {
    return "district_heating";
  }

  // ── Railway (highest priority — very specific signals) ─────────────────────
  if (
    lower.includes("indian railways") ||
    lower.includes("irctc") ||
    lower.includes("e-ticket") ||
    lower.includes("eticket") ||
    lower.includes("electronic reservation slip") ||
    lower.includes("pnr") ||
    lower.includes("train no") ||
    lower.includes("train number") ||
    lower.includes("boarding at") ||
    lower.includes("passenger details") ||
    lower.includes("current booking") ||
    lower.includes("railway") ||
    lower.includes("train") ||
    lower.includes("passenger-km") ||
    lower.includes("passenger km") ||
    lower.includes("pkm")
  ) {
    return "railway";
  }

  // ── Flight ─────────────────────────────────────────────────────────────────
  if (
    lower.includes("flight") ||
    lower.includes("air travel") ||
    lower.includes("airline") ||
    lower.includes("airways") ||
    lower.includes("airport") ||
    lower.includes("domestic flight") ||
    lower.includes("international flight")
  ) {
    return "flight";
  }

  // ── LPG — MUST be before natural_gas to avoid cross-match ─────────────────
  if (
    lower.includes("lpg") ||
    lower.includes("liquefied petroleum gas") ||
    lower.includes("gas cylinder") ||
    lower.includes("autogas") ||
    lower.includes("propane") ||
    lower.includes("butane")
  ) {
    return "lpg";
  }

  // ── Natural Gas — MUST be before electricity (AU gas invoices have "energy") ─
  if (
    lower.includes("natural gas") ||
    lower.includes("pipeline gas") ||
    lower.includes("png") ||
    lower.includes("cng") ||
    // AU-specific gas utility keywords
    lower.includes("gas supply") ||
    lower.includes("gas usage") ||
    lower.includes("gas charges") ||
    lower.includes("gas tariff") ||
    lower.includes("gas consumption") ||
    lower.includes("mj of gas") ||
    lower.includes("gigajoule") ||
    lower.includes("gj of gas") ||
    lower.includes("agn gas") ||       // Australian Gas Networks
    lower.includes("jemena gas") ||    // Jemena (AU gas distributor)
    lower.includes("evoenergy gas")    // Evoenergy gas (ACT)
  ) {
    return "natural_gas";
  }

  // ── Diesel ─────────────────────────────────────────────────────────────────
  if (
    lower.includes("diesel") ||
    lower.includes("hsd") ||
    lower.includes("diesel oil") ||
    lower.includes("distillate") ||
    lower.includes("fuel oil no. 2") ||
    lower.includes("fuel oil no.2") ||
    lower.includes("no. 2 fuel oil")
  ) {
    return "diesel";
  }

  // ── Petrol ─────────────────────────────────────────────────────────────────
  if (
    (lower.includes("petrol") && !lower.includes("petroleum")) ||
    lower.includes("gasoline") ||
    lower.includes("motor spirit") ||
    lower.includes("unleaded") ||
    lower.includes("e10") ||
    lower.includes("e85")
  ) {
    return "petrol";
  }

  // ── Electricity — after gas/LPG to prevent AU gas bill misclassification ──
  if (
    lower.includes("electricity") ||
    lower.includes("power bill") ||
    lower.includes("electric bill") ||
    lower.includes("kwh") ||
    lower.includes("kwj") ||
    lower.includes("unit consumed") ||
    lower.includes("energy charges") ||
    lower.includes("dhbvn") ||
    lower.includes("uppcl") ||
    lower.includes("bses") ||
    lower.includes("tata power") ||
    lower.includes("adani electricity") ||
    // AU electricity utilities
    lower.includes("agl") ||           // AGL Energy
    lower.includes("origin energy") ||
    lower.includes("energex") ||       // QLD
    lower.includes("ergon energy") ||  // QLD rural
    lower.includes("endeavour energy") || // NSW
    lower.includes("ausgrid") ||       // NSW
    lower.includes("western power") || // WA
    lower.includes("synergy") ||       // WA
    lower.includes("sa power networks") || // SA
    lower.includes("powercor") ||      // VIC
    lower.includes("citipower") ||     // VIC
    lower.includes("united energy") || // VIC
    lower.includes("jemena electricity") || // VIC/NSW
    lower.includes("aurora energy") || // TAS
    lower.includes("actew") ||         // ACT
    lower.includes("evoenergy") ||     // ACT electricity
    lower.includes("power and water") || // NT
    lower.includes("grid usage") ||
    lower.includes("network tariff") ||
    lower.includes("supply charge")
  ) {
    return "electricity";
  }

  // ── Materials ──────────────────────────────────────────────────────────────
  if (
    lower.includes("steel") ||
    lower.includes("tmt") ||
    lower.includes("iron") ||
    lower.includes("ms steel") ||
    lower.includes("mild steel") ||
    lower.includes("steel rod") ||
    lower.includes("steel bar") ||
    lower.includes("steel pipe") ||
    lower.includes("ms billet") ||
    lower.includes("billet") ||
    lower.includes("tmt bar") ||
    lower.includes("round bar") ||
    lower.includes("rebar") ||
    lower.includes("structural steel") ||
    lower.includes("steel section") ||
    lower.includes("coil") ||
    lower.includes("wire rod") ||
    lower.includes("beam") ||
    lower.includes("angle") ||
    lower.includes("channel")
  ) {
    return "steel";
  }

  if (
    lower.includes("aluminium") ||
    lower.includes("aluminum") ||
    lower.includes("aluminium sheet") ||
    lower.includes("aluminium bar") ||
    lower.includes("aluminium profile") ||
    lower.includes("aluminium extrusion")
  ) {
    return "aluminium";
  }

  if (
    lower.includes("textile") ||
    lower.includes("fabric") ||
    lower.includes("cloth") ||
    lower.includes("cotton") ||
    lower.includes("polyester") ||
    lower.includes("garment") ||
    lower.includes("apparel") ||
    lower.includes("yarn")
  ) {
    return "textile";
  }

  if (
    lower.includes("electrical goods") ||
    lower.includes("electrical item") ||
    lower.includes("electrical equipment") ||
    lower.includes("electrical component") ||
    lower.includes("electronics") ||
    lower.includes("wire") ||
    lower.includes("cable") ||
    lower.includes("switch") ||
    lower.includes("panel") ||
    lower.includes("motor") ||
    lower.includes("transformer") ||
    lower.includes("led") ||
    lower.includes("lamp") ||
    lower.includes("light")
  ) {
    return "electrical";
  }

  if (
    lower.includes("natural_gas") ||   // fallback catch (already handled above)
    lower.includes("png") ||
    lower.includes("cng")
  ) {
    return "natural_gas";
  }

  if (
    lower.includes("coal") ||
    lower.includes("lignite") ||
    lower.includes("coking coal") ||
    lower.includes("thermal coal")
  ) {
    return "coal";
  }

  if (
    lower.includes("cement") ||
    lower.includes("opc") ||
    lower.includes("ppc cement")
  ) {
    return "cement";
  }

  if (
    lower.includes("concrete") ||
    lower.includes("ready mix") ||
    lower.includes("rmc")
  ) {
    return "concrete";
  }

  if (
    lower.includes("glass") ||
    lower.includes("glass sheet") ||
    lower.includes("float glass")
  ) {
    return "glass";
  }

  if (
    lower.includes("plastic") ||
    lower.includes("hdpe") ||
    lower.includes("ldpe") ||
    lower.includes("polymer") ||
    lower.includes("pvc") ||
    lower.includes("pet")
  ) {
    return "plastic";
  }

  if (
    lower.includes("paper") ||
    lower.includes("cardboard") ||
    lower.includes("corrugated")
  ) {
    return "paper";
  }

  if (
    lower.includes("wood") ||
    lower.includes("timber") ||
    lower.includes("plywood") ||
    lower.includes("mdf") ||
    lower.includes("flush door")
  ) {
    return "wood";
  }

  if (
    lower.includes("food") ||
    lower.includes("rice") ||
    lower.includes("wheat") ||
    lower.includes("milk") ||
    lower.includes("processed food")
  ) {
    return "food";
  }

  if (
    lower.includes("chemical") ||
    lower.includes("paint") ||
    lower.includes("solvent") ||
    lower.includes("resin") ||
    lower.includes("adhesive")
  ) {
    return "chemicals";
  }

  if (
    lower.includes("refrigerant") ||
    lower.includes("r134a") ||
    lower.includes("r410a") ||
    lower.includes("r32") ||
    lower.includes("hfc")
  ) {
    return "refrigerant";
  }

  if (
    lower.includes("waste") ||
    lower.includes("landfill") ||
    lower.includes("garbage") ||
    lower.includes("municipal waste") ||
    lower.includes("scrap")
  ) {
    return "waste";
  }

  if (
    lower.includes("water") ||
    lower.includes("water supply") ||
    lower.includes("water bill")
  ) {
    return "water";
  }

  if (
    lower.includes("freight") ||
    lower.includes("logistics") ||
    lower.includes("shipping") ||
    lower.includes("tonne-km") ||
    lower.includes("tkm") ||
    lower.includes("goods transport")
  ) {
    return "freight";
  }

  if (
    lower.includes("transport") ||
    lower.includes("vehicle") ||
    lower.includes("truck") ||
    lower.includes("lorry") ||
    lower.includes("cab") ||
    lower.includes("taxi")
  ) {
    return "transport";
  }

  if (
    lower.includes("hotel") ||
    lower.includes("accommodation") ||
    lower.includes("room night") ||
    lower.includes("lodging")
  ) {
    return "hotel";
  }

  if (
    lower.includes("bank") ||
    lower.includes("banking") ||
    lower.includes("financial service") ||
    lower.includes("finance")
  ) {
    return "banking";
  }

  if (
    lower.includes("university") ||
    lower.includes("college") ||
    lower.includes("education") ||
    lower.includes("tuition") ||
    lower.includes("school")
  ) {
    return "university";
  }

  if (
    lower.includes("export") ||
    lower.includes("exporter") ||
    lower.includes("export invoice")
  ) {
    return "exporter";
  }

  if (
    lower.includes("manufacturing") ||
    lower.includes("factory") ||
    lower.includes("production") ||
    lower.includes("industrial")
  ) {
    return "manufacturing";
  }

  if (
    lower.includes("service") ||
    lower.includes("services") ||
    lower.includes("consulting") ||
    lower.includes("maintenance") ||
    lower.includes("repair")
  ) {
    return "services";
  }

  return "unknown";
}
