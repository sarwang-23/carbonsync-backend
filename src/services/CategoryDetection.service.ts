export function detectCategoryFromText(text: string): string {
  const lower = text.toLowerCase();

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
    lower.includes("adani electricity")
  ) {
    return "electricity";
  }

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

  if (
    lower.includes("steel") ||
    lower.includes("tmt") ||
    lower.includes("iron") ||
    lower.includes("ms steel") ||
    lower.includes("mild steel") ||
    lower.includes("steel rod") ||
    lower.includes("steel bar") ||
    lower.includes("steel pipe")
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
    lower.includes("diesel") ||
    lower.includes("hsd") ||
    lower.includes("diesel oil")
  ) {
    return "diesel";
  }

  if (
    lower.includes("petrol") ||
    lower.includes("gasoline") ||
    lower.includes("motor spirit")
  ) {
    return "petrol";
  }

  if (
    lower.includes("lpg") ||
    lower.includes("liquefied petroleum gas") ||
    lower.includes("gas cylinder")
  ) {
    return "lpg";
  }

  if (
    lower.includes("natural gas") ||
    lower.includes("png") ||
    lower.includes("cng") ||
    lower.includes("pipeline gas")
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
