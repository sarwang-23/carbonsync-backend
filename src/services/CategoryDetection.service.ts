export function detectCategoryFromText(text: string): string {
  const lower = text.toLowerCase();

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 0: Industry-specific raw materials — MUST be BEFORE generic steel/coal
  // to prevent Iron Ore → steel, Coke → coal (wrong mapping) etc.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Iron Ore (raw mining material — NOT finished steel) ───────────────────
  if (
    lower.includes("iron ore") ||
    lower.includes("iron ore fines") ||
    lower.includes("iron ore lumps") ||
    lower.includes("iron ore pellet") ||
    lower.includes("ore fines") ||
    lower.includes("ore lumps") ||
    lower.includes("magnetite") ||
    lower.includes("hematite") ||
    lower.includes("sinter feed") ||
    lower.includes("lump ore") ||
    lower.includes("pellet feed") ||
    lower.includes("sponge iron") ||
    lower.includes("pig iron") ||
    lower.includes("direct reduced iron") ||
    /\bdri\b/.test(lower) ||
    lower.includes("hot briquetted iron") ||
    /\bhbi\b/.test(lower)
  ) {
    return "iron_ore";
  }

  // ── Ferro Alloys ─────────────────────────────────────────────────────────
  if (
    lower.includes("ferro silicon") ||
    lower.includes("ferrosilicon") ||
    lower.includes("fe-si") ||
    lower.includes("fesi") ||
    lower.includes("ferro manganese") ||
    lower.includes("ferromanganese") ||
    lower.includes("fe-mn") ||
    lower.includes("femn") ||
    lower.includes("silico manganese") ||
    lower.includes("silicomanganese") ||
    lower.includes("simn") ||
    lower.includes("ferro chrome") ||
    lower.includes("ferrochrome") ||
    lower.includes("fe-cr") ||
    lower.includes("fecr") ||
    lower.includes("ferro alloy") ||
    lower.includes("ferroalloy") ||
    lower.includes("ferro titanium") ||
    lower.includes("ferro molybdenum") ||
    lower.includes("ferro vanadium") ||
    lower.includes("ferro boron") ||
    lower.includes("ferro niobium") ||
    lower.includes("calcium silicide") ||
    lower.includes("cored wire")
  ) {
    return "ferro_alloy";
  }

  // ── Limestone & Minerals ─────────────────────────────────────────────────
  if (
    lower.includes("limestone") ||
    lower.includes("lime stone") ||
    lower.includes("dolomite") ||
    lower.includes("quick lime") ||
    lower.includes("quicklime") ||
    lower.includes("hydrated lime") ||
    lower.includes("calcined lime") ||
    lower.includes("burnt lime") ||
    lower.includes("calcium carbonate") ||
    lower.includes("calcium oxide") ||
    lower.includes("magnesium carbonate") ||
    lower.includes("calcite") ||
    lower.includes("flux stone")
  ) {
    return "limestone";
  }

  // ── Metallurgical Coke (steel industry input — NOT thermal coal) ──────────
  if (
    lower.includes("coke breeze") ||
    lower.includes("met coke") ||
    lower.includes("metallurgical coke") ||
    lower.includes("bf coke") ||
    lower.includes("blast furnace coke") ||
    lower.includes("coke nut") ||
    lower.includes("pearl coke") ||
    lower.includes("foundry coke") ||
    lower.includes("petroleum coke") ||
    lower.includes("pet coke") ||
    lower.includes("petcoke")
  ) {
    return "coal"; // Mapped to coal category (Climatiq has coke under coal EFs)
  }

  // ── Scrap Metal ──────────────────────────────────────────────────────────
  if (
    lower.includes("scrap metal") ||
    lower.includes("steel scrap") ||
    lower.includes("iron scrap") ||
    lower.includes("metal scrap") ||
    lower.includes("ms scrap") ||
    lower.includes("shredded scrap") ||
    lower.includes("hms scrap") ||
    lower.includes("heavy melting scrap")
  ) {
    return "scrap_metal";
  }

  // ── Bauxite & Alumina (aluminium production inputs) ──────────────────────
  if (
    lower.includes("bauxite") ||
    lower.includes("alumina") ||
    lower.includes("al2o3") ||
    lower.includes("aluminium oxide") ||
    lower.includes("aluminum oxide")
  ) {
    return "bauxite";
  }

  // ── Copper Ore & Concentrate ─────────────────────────────────────────────
  if (
    lower.includes("copper ore") ||
    lower.includes("copper concentrate") ||
    lower.includes("copper cathode") ||
    lower.includes("copper rod") ||
    lower.includes("blister copper")
  ) {
    return "copper";
  }

  // ── Sand, Aggregates, Quarried Materials ─────────────────────────────────
  if (
    lower.includes("silica sand") ||
    lower.includes("quartz sand") ||
    lower.includes("river sand") ||
    lower.includes("m-sand") ||
    lower.includes("crushed stone") ||
    lower.includes("granite aggregate") ||
    lower.includes("aggregates") ||
    lower.includes("gravel") ||
    lower.includes("quartzite")
  ) {
    return "aggregates";
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 1: Energy & Utilities
  // ═══════════════════════════════════════════════════════════════════════════

  // ── District Heating ─────────────────────────────────────────────────────
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

  // ── Railway ──────────────────────────────────────────────────────────────
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

  // ── Flight ───────────────────────────────────────────────────────────────
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

  // ── LPG ──────────────────────────────────────────────────────────────────
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

  // ── Natural Gas ──────────────────────────────────────────────────────────
  if (
    lower.includes("natural gas") ||
    lower.includes("pipeline gas") ||
    lower.includes("png") ||
    lower.includes("cng") ||
    lower.includes("gas supply") ||
    lower.includes("gas usage") ||
    lower.includes("gas charges") ||
    lower.includes("gas tariff") ||
    lower.includes("gas consumption") ||
    lower.includes("mj of gas") ||
    lower.includes("gigajoule") ||
    lower.includes("gj of gas") ||
    lower.includes("agn gas") ||
    lower.includes("jemena gas") ||
    lower.includes("evoenergy gas")
  ) {
    return "natural_gas";
  }

  // ── Diesel ───────────────────────────────────────────────────────────────
  if (
    lower.includes("diesel") ||
    lower.includes("diesel oil") ||
    lower.includes("distillate") ||
    lower.includes("fuel oil no. 2") ||
    lower.includes("fuel oil no.2") ||
    lower.includes("no. 2 fuel oil") ||
    lower.includes("high speed diesel") ||
    lower.includes("ultra low sulfur diesel") ||
    lower.includes("ulsd")
  ) {
    return "diesel";
  }

  // ── Petrol ───────────────────────────────────────────────────────────────
  if (
    (lower.includes("petrol") && !lower.includes("petroleum")) ||
    lower.includes("motor spirit") ||
    lower.includes("unleaded") ||
    lower.includes("e10") ||
    lower.includes("e85") ||
    lower.includes("petrol 91") ||
    lower.includes("petrol 95") ||
    lower.includes("ron 91") ||
    lower.includes("ron 95")
  ) {
    return "petrol";
  }

  // ── Electricity ──────────────────────────────────────────────────────────
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
    lower.includes("agl") ||
    lower.includes("origin energy") ||
    lower.includes("energex") ||
    lower.includes("ergon energy") ||
    lower.includes("endeavour energy") ||
    lower.includes("ausgrid") ||
    lower.includes("western power") ||
    lower.includes("synergy") ||
    lower.includes("sa power networks") ||
    lower.includes("powercor") ||
    lower.includes("citipower") ||
    lower.includes("united energy") ||
    lower.includes("jemena electricity") ||
    lower.includes("aurora energy") ||
    lower.includes("actew") ||
    lower.includes("evoenergy") ||
    lower.includes("power and water") ||
    lower.includes("grid usage") ||
    lower.includes("network tariff") ||
    lower.includes("supply charge")
  ) {
    return "electricity";
  }

  // ── Coal ─────────────────────────────────────────────────────────────────
  if (
    lower.includes("coal") ||
    lower.includes("lignite") ||
    lower.includes("coking coal") ||
    lower.includes("thermal coal") ||
    lower.includes("steam coal") ||
    lower.includes("sub-bituminous") ||
    lower.includes("bituminous coal") ||
    lower.includes("anthracite") ||
    lower.includes("coal fines") ||
    lower.includes("washed coal") ||
    lower.includes("coal dust")
  ) {
    return "coal";
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 2: Finished Materials (steel must be AFTER iron_ore / scrap_metal)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Steel (finished products only) ───────────────────────────────────────
  if (
    lower.includes("steel") ||
    lower.includes("tmt") ||
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
    lower.includes("steel coil") ||
    lower.includes("wire rod") ||
    lower.includes("steel beam") ||
    lower.includes("steel angle") ||
    lower.includes("steel channel") ||
    lower.includes("hot rolled") ||
    lower.includes("cold rolled") ||
    lower.includes("galvanized") ||
    lower.includes("gi sheet") ||
    lower.includes("hr coil") ||
    lower.includes("cr coil")
  ) {
    return "steel";
  }

  // ── Aluminium ────────────────────────────────────────────────────────────
  if (
    lower.includes("aluminium") ||
    lower.includes("aluminum") ||
    lower.includes("aluminium sheet") ||
    lower.includes("aluminium bar") ||
    lower.includes("aluminium profile") ||
    lower.includes("aluminium extrusion") ||
    lower.includes("aluminium ingot") ||
    lower.includes("aluminium billet")
  ) {
    return "aluminium";
  }

  // ── Cement ───────────────────────────────────────────────────────────────
  if (
    lower.includes("cement") ||
    lower.includes("opc") ||
    lower.includes("ppc cement") ||
    lower.includes("portland cement") ||
    lower.includes("slag cement") ||
    lower.includes("fly ash cement")
  ) {
    return "cement";
  }

  // ── Concrete ─────────────────────────────────────────────────────────────
  if (
    lower.includes("concrete") ||
    lower.includes("ready mix") ||
    lower.includes("rmc") ||
    lower.includes("ready mixed concrete")
  ) {
    return "concrete";
  }

  // ── Chemicals ────────────────────────────────────────────────────────────
  if (
    lower.includes("chemical") ||
    lower.includes("paint") ||
    lower.includes("solvent") ||
    lower.includes("resin") ||
    lower.includes("adhesive") ||
    lower.includes("sulphuric acid") ||
    lower.includes("sulfuric acid") ||
    lower.includes("hydrochloric acid") ||
    lower.includes("caustic soda") ||
    lower.includes("soda ash") ||
    lower.includes("ammonia") ||
    lower.includes("sodium hydroxide") ||
    lower.includes("ferric chloride") ||
    lower.includes("flux")
  ) {
    return "chemicals";
  }

  // ── Textile ──────────────────────────────────────────────────────────────
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

  // ── Electrical Goods ─────────────────────────────────────────────────────
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

  // ── Glass ────────────────────────────────────────────────────────────────
  if (
    lower.includes("glass") ||
    lower.includes("glass sheet") ||
    lower.includes("float glass")
  ) {
    return "glass";
  }

  // ── Plastic ──────────────────────────────────────────────────────────────
  if (
    lower.includes("plastic") ||
    lower.includes("hdpe") ||
    lower.includes("ldpe") ||
    lower.includes("polymer") ||
    lower.includes("pvc") ||
    lower.includes("pet resin")
  ) {
    return "plastic";
  }

  // ── Paper ────────────────────────────────────────────────────────────────
  if (
    lower.includes("paper") ||
    lower.includes("cardboard") ||
    lower.includes("corrugated")
  ) {
    return "paper";
  }

  // ── Wood ─────────────────────────────────────────────────────────────────
  if (
    lower.includes("wood") ||
    lower.includes("timber") ||
    lower.includes("plywood") ||
    lower.includes("mdf") ||
    lower.includes("flush door")
  ) {
    return "wood";
  }

  // ── Food ─────────────────────────────────────────────────────────────────
  if (
    lower.includes("food") ||
    lower.includes("rice") ||
    lower.includes("wheat") ||
    lower.includes("milk") ||
    lower.includes("processed food")
  ) {
    return "food";
  }

  // ── Refrigerant ──────────────────────────────────────────────────────────
  if (
    lower.includes("refrigerant") ||
    lower.includes("r134a") ||
    lower.includes("r410a") ||
    lower.includes("r32") ||
    lower.includes("hfc")
  ) {
    return "refrigerant";
  }

  // ── Waste ────────────────────────────────────────────────────────────────
  if (
    lower.includes("waste") ||
    lower.includes("landfill") ||
    lower.includes("garbage") ||
    lower.includes("municipal waste")
  ) {
    return "waste";
  }

  // ── Water ────────────────────────────────────────────────────────────────
  if (
    lower.includes("water") ||
    lower.includes("water supply") ||
    lower.includes("water bill")
  ) {
    return "water";
  }

  // ── Freight / Logistics ──────────────────────────────────────────────────
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

  // ── Transport ────────────────────────────────────────────────────────────
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

  // ── Hotel ────────────────────────────────────────────────────────────────
  if (
    lower.includes("hotel") ||
    lower.includes("accommodation") ||
    lower.includes("room night") ||
    lower.includes("lodging")
  ) {
    return "hotel";
  }

  // ── Services / Manufacturing / Others ────────────────────────────────────
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

  return "unknown";
}
