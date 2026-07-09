export function detectCategoryFromText(text: string, vendorName?: string, unit?: string): string {
  const lower = text.toLowerCase();

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 0: Industry-specific raw materials & intermediates
  // Must run BEFORE generic steel/coal to prevent misclassification
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Vendor Intelligence ──────────────────────────────────────────────────
  let vendorIsTextile = false;
  if (vendorName) {
    const v = vendorName.toLowerCase();
    if (
      v.includes("textile") || v.includes("fabric") || v.includes("yarn") ||
      v.includes("weaving") || v.includes("knitting") || v.includes("garment") ||
      v.includes("cotton") || v.includes("apparel") || v.includes("hosiery") ||
      v.includes("dyeing") || v.includes("spinning") || v.includes("mills") ||
      v.includes("loom") || v.includes("embroidery") || v.includes("silk") ||
      v.includes("woolen") || v.includes("denim") || v.includes("linen") ||
      v.includes("thread") || v.includes("fibre") || v.includes("fiber") ||
      v.includes("suiting") || v.includes("shirting") || v.includes("dress material") ||
      v.includes("saree") || v.includes("kurta") || v.includes("uniform") ||
      v.includes("export house") || v.includes("readymade") || v.includes("fashion")
    ) {
      vendorIsTextile = true;
    }
  }

  // 1. Iron Ore
  if (
    lower.includes("iron ore") ||
    lower.includes("iron ore fines") ||
    lower.includes("iron ore lumps") ||
    lower.includes("iron ore pellets") ||
    lower.includes("iron ore concentrate") ||
    lower.includes("ore fines") ||
    lower.includes("ore lumps") ||
    lower.includes("sinter feed") ||
    lower.includes("pellet feed") ||
    lower.includes("magnetite") ||
    lower.includes("hematite") ||
    lower.includes("beneficiated ore") ||
    lower.includes("iron concentrate") ||
    lower.includes("lump ore")
  ) {
    return "iron_ore";
  }

  // 2. Direct Reduced Iron (DRI) / Sponge Iron
  if (
    lower.includes("dri") ||
    lower.includes("direct reduced iron") ||
    lower.includes("sponge iron") ||
    lower.includes("hot briquetted iron") ||
    lower.includes("hbi") ||
    lower.includes("cold dri")
  ) {
    return "dri";
  }

  // 3. Pig Iron
  if (
    lower.includes("pig iron") ||
    lower.includes("basic pig iron") ||
    lower.includes("foundry pig iron") ||
    lower.includes("steel grade pig iron")
  ) {
    return "pig_iron";
  }

  // 4. Coke
  if (
    lower.includes("coke breeze") ||
    lower.includes("met coke") ||
    lower.includes("metallurgical coke") ||
    lower.includes("nut coke") ||
    lower.includes("foundry coke") ||
    lower.includes("blast furnace coke") ||
    lower.includes("bf coke") ||
    lower.includes("coke fines") ||
    lower.includes("green coke") ||
    lower.includes("calcined coke") ||
    lower.includes("pet coke") ||
    lower.includes("petroleum coke") ||
    lower.includes("coke nut") ||
    lower.includes("pearl coke") ||
    // precise match for standalone 'coke'
    /\bcoke\b/.test(lower) && !lower.includes("coca") 
  ) {
    return "coke";
  }

  // 5. Dolomite
  if (
    lower.includes("dolomite") ||
    lower.includes("dolomite chips") ||
    lower.includes("dolomite powder") ||
    lower.includes("raw dolomite") ||
    lower.includes("burnt dolomite") ||
    lower.includes("calcined dolomite")
  ) {
    return "dolomite";
  }

  // 6. Limestone
  if (
    lower.includes("limestone") ||
    lower.includes("limestone chips") ||
    lower.includes("limestone powder") ||
    lower.includes("lime stone") ||
    lower.includes("dolomite limestone") ||
    lower.includes("calcite") ||
    lower.includes("crushed limestone") ||
    lower.includes("high calcium limestone") ||
    lower.includes("flux limestone") ||
    lower.includes("calcium carbonate") ||
    lower.includes("magnesium carbonate") ||
    lower.includes("flux stone")
  ) {
    return "limestone";
  }

  // 7. Lime
  if (
    lower.includes("quick lime") ||
    lower.includes("quicklime") ||
    lower.includes("hydrated lime") ||
    lower.includes("burnt lime") ||
    lower.includes("calcined lime") ||
    lower.includes("cao") ||
    lower.includes("calcium oxide")
  ) {
    return "lime";
  }

  // 8. Ferro Alloys
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
    lower.includes("low carbon ferro chrome") ||
    lower.includes("high carbon ferro chrome") ||
    lower.includes("ferro nickel") ||
    lower.includes("ferro vanadium") ||
    lower.includes("ferro titanium") ||
    lower.includes("ferro boron") ||
    lower.includes("ferro phosphorus") ||
    lower.includes("ferro molybdenum") ||
    lower.includes("ferro tungsten") ||
    lower.includes("ferro niobium") ||
    lower.includes("ferro zirconium") ||
    lower.includes("ferro aluminium") ||
    lower.includes("ferro cobalt") ||
    lower.includes("ferro alloy") ||
    lower.includes("ferroalloy") ||
    lower.includes("calcium silicide") ||
    lower.includes("cored wire")
  ) {
    return "ferro_alloy";
  }

  // 9. Scrap (Steel Scrap)
  if (
    lower.includes("steel scrap") ||
    lower.includes("ms scrap") ||
    lower.includes("heavy melting scrap") ||
    lower.includes("hms") ||
    lower.includes("shredded scrap") ||
    lower.includes("plate scrap") ||
    lower.includes("turnings") ||
    lower.includes("busheling") ||
    lower.includes("pig iron scrap") ||
    lower.includes("iron scrap") ||
    lower.includes("cast iron scrap") ||
    lower.includes("recycled steel") ||
    lower.includes("metal scrap") ||
    lower.includes("scrap metal")
  ) {
    return "steel_scrap";
  }

  // 10. Semi-Finished (Billet, Bloom, Slab)
  if (
    lower.includes("billet") ||
    lower.includes("steel billet") ||
    lower.includes("ms billet") ||
    lower.includes("alloy billet") ||
    lower.includes("square billet")
  ) {
    return "billet";
  }

  if (
    lower.includes("bloom") ||
    lower.includes("steel bloom")
  ) {
    return "bloom";
  }

  if (
    lower.includes("slab") ||
    lower.includes("steel slab") ||
    lower.includes("hot slab")
  ) {
    return "slab";
  }

  // 11. Refractories
  if (
    lower.includes("refractory") ||
    lower.includes("fire brick") ||
    lower.includes("magnesia brick") ||
    lower.includes("alumina brick") ||
    lower.includes("graphite electrode") ||
    lower.includes("carbon brick") ||
    lower.includes("ceramic lining")
  ) {
    return "refractory";
  }

  // 12. Flux
  if (
    lower.includes("flux") && !lower.includes("flux limestone") && !lower.includes("flux stone") ||
    lower.includes("flux material") ||
    lower.includes("bf flux") ||
    lower.includes("bof flux") ||
    lower.includes("sinter flux") ||
    lower.includes("basic flux")
  ) {
    return "flux";
  }

  // 13. Industrial Gases
  if (
    lower.includes("oxygen") ||
    lower.includes("liquid oxygen") ||
    lower.includes("nitrogen") ||
    lower.includes("liquid nitrogen") ||
    lower.includes("argon") ||
    lower.includes("liquid argon") ||
    lower.includes("hydrogen") ||
    lower.includes("acetylene") ||
    lower.includes("compressed air") ||
    lower.includes("industrial gas")
  ) {
    return "industrial_gas";
  }

  // 14. Cast Products & Powders
  if (
    lower.includes("cast iron") ||
    lower.includes("ductile iron") ||
    lower.includes("grey iron")
  ) {
    return "cast_iron";
  }

  if (
    lower.includes("iron powder")
  ) {
    return "iron_powder";
  }

  if (
    lower.includes("steel powder")
  ) {
    return "steel_powder";
  }

  if (
    lower.includes("ingot")
  ) {
    return "ingot";
  }

  // 15. By-products
  if (
    lower.includes("slag") ||
    lower.includes("blast furnace slag") ||
    lower.includes("bof slag") ||
    lower.includes("steel slag") ||
    lower.includes("mill scale") ||
    lower.includes("fly ash") ||
    lower.includes("dust") ||
    /\bash\b/.test(lower) ||
    lower.includes("waste heat") ||
    lower.includes("tar") ||
    lower.includes("benzol")
  ) {
    return "byproduct";
  }

  // 16. Other non-steel raw materials (Bauxite, Copper, Aggregates, Minerals)
  if (
    lower.includes("quartz")
  ) {
    return "quartz";
  }

  if (
    lower.includes("bentonite")
  ) {
    return "bentonite";
  }

  if (
    lower.includes("bauxite") ||
    lower.includes("alumina") ||
    lower.includes("al2o3") ||
    lower.includes("aluminium oxide") ||
    lower.includes("aluminum oxide")
  ) {
    return "bauxite";
  }

  if (
    lower.includes("copper ore") ||
    lower.includes("copper concentrate") ||
    lower.includes("copper cathode") ||
    lower.includes("copper rod") ||
    lower.includes("blister copper")
  ) {
    return "copper";
  }

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
  // PRIORITY 1: Energy, Utilities & Transport (Untouched for backward compatibility)
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
    lower.includes("lng") ||
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

  // ── Fuel (Diesel / FO / etc) ─────────────────────────────────────────────
  if (
    lower.includes("diesel") ||
    lower.includes("diesel oil") ||
    lower.includes("distillate") ||
    lower.includes("fuel oil no. 2") ||
    lower.includes("fuel oil no.2") ||
    lower.includes("no. 2 fuel oil") ||
    lower.includes("high speed diesel") ||
    lower.includes("hsd") ||
    lower.includes("ultra low sulfur diesel") ||
    lower.includes("ulsd") ||
    lower.includes("light diesel oil") ||
    lower.includes("furnace oil") ||
    lower.includes("heavy fuel oil") ||
    /\bfo\b/.test(lower) ||
    lower.includes("biofuel")
  ) {
    return "fuel"; // Previously diesel, now fuel to group them correctly
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
    lower.includes("power") && !lower.includes("power bill") && !lower.includes("powder") ||
    lower.includes("power bill") ||
    lower.includes("electric bill") ||
    lower.includes("grid electricity") ||
    lower.includes("purchased electricity") ||
    lower.includes("renewable electricity") ||
    lower.includes("solar power") ||
    lower.includes("wind power") ||
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

  // ── Coal (General) ───────────────────────────────────────────────────────
  if (
    lower.includes("coal") ||
    lower.includes("steam coal") ||
    lower.includes("thermal coal") ||
    lower.includes("coking coal") ||
    lower.includes("metallurgical coal") ||
    lower.includes("pci coal") ||
    lower.includes("pulverized coal") ||
    lower.includes("anthracite") ||
    lower.includes("bituminous coal") ||
    lower.includes("sub-bituminous coal") ||
    lower.includes("lignite") ||
    lower.includes("brown coal") ||
    lower.includes("coal fines") ||
    lower.includes("washed coal") ||
    lower.includes("coal dust")
  ) {
    return "coal";
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 2: Finished Materials (Steel, Alu, Chem, etc)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Stainless Steel ──────────────────────────────────────────────────────
  if (
    lower.includes("stainless steel") ||
    lower.includes("ss coil") ||
    lower.includes("ss sheet") ||
    lower.includes("ss pipe") ||
    lower.includes("ss plate") ||
    lower.includes("ss scrap")
  ) {
    return "stainless_steel";
  }

  // ── Alloy Steel ──────────────────────────────────────────────────────────
  if (
    lower.includes("alloy steel") ||
    lower.includes("carbon steel") ||
    lower.includes("tool steel") ||
    lower.includes("spring steel") ||
    lower.includes("bearing steel") ||
    lower.includes("electrical steel") ||
    lower.includes("silicon steel")
  ) {
    return "alloy_steel";
  }

  // ── Structural Steel ──────────────────────────────────────────────────────
  if (
    lower.includes("angle") ||
    lower.includes("channel") ||
    lower.includes("beam") ||
    lower.includes("joist") ||
    lower.includes("h beam") ||
    lower.includes("i beam") ||
    lower.includes("structural steel") ||
    lower.includes("steel section") ||
    lower.includes("steel rail")
  ) {
    return "structural_steel";
  }

  // ── Steel Plate ──────────────────────────────────────────────────────────
  if (
    lower.includes("plate") ||
    lower.includes("steel plate") ||
    lower.includes("ms plate")
  ) {
    return "steel_plate";
  }

  // ── Steel Sheet ──────────────────────────────────────────────────────────
  // Guard: aluminium/aluminum sheets must NOT match steel_sheet
  if (
    (lower.includes("aluminium") || lower.includes("aluminum")) &&
    lower.includes("sheet")
  ) {
    return "aluminium";
  }

  if (
    lower.includes("sheet") ||
    lower.includes("steel sheet") ||
    lower.includes("cr sheet") ||
    lower.includes("hr sheet") ||
    lower.includes("gi sheet") ||
    lower.includes("gp sheet")
  ) {
    return "steel_sheet";
  }

  // ── Steel Coil ───────────────────────────────────────────────────────────
  if (
    lower.includes("coil") ||
    lower.includes("steel coil") ||
    lower.includes("hot rolled coil") ||
    lower.includes("cold rolled coil") ||
    lower.includes("gp coil") ||
    lower.includes("gi coil") ||
    lower.includes("hr coil") ||
    lower.includes("cr coil") ||
    lower.includes("crc") ||
    lower.includes("hrc")
  ) {
    return "steel_coil";
  }

  // ── Steel Pipe ───────────────────────────────────────────────────────────
  if (
    lower.includes("pipe") ||
    lower.includes("steel pipe") ||
    lower.includes("tube") ||
    lower.includes("steel tube") ||
    lower.includes("hollow section")
  ) {
    return "steel_pipe";
  }

  // ── Finished Steel (Bars, Rods, Generic) ─────────────────────────────────
  if (
    lower.includes("tmt bar") ||
    lower.includes("tmt fe500") ||
    lower.includes("tmt fe550") ||
    lower.includes("rebar") ||
    lower.includes("steel rod") ||
    lower.includes("steel bar") ||
    lower.includes("wire rod") ||
    lower.includes("ms rod") ||
    lower.includes("flat steel") ||
    lower.includes("steel") ||
    lower.includes("tmt") ||
    lower.includes("ms steel") ||
    lower.includes("mild steel") ||
    lower.includes("galvanized")
  ) {
    return "finished_steel";
  }

  // ── Aluminium ────────────────────────────────────────────────────────────
  // Aluminium cables & conductors → electrical (not raw aluminium metal)
  if (
    (lower.includes("aluminium") || lower.includes("aluminum")) &&
    (
      lower.includes("cable") ||
      lower.includes("conductor") ||
      lower.includes("ht cable") ||
      lower.includes("lt cable") ||
      lower.includes("armoured cable") ||
      lower.includes("xlpe") ||
      lower.includes("pvc insulated") ||
      lower.includes("avocab") ||
      lower.includes("submersible cable")
    )
  ) {
    return "electrical";
  }

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

  // ── Industrial Chemicals (MASTER MAPPING) ────────────────────────────────
  if (
    lower.includes("chemical") || lower.includes("chemicals") ||
    lower.includes("caustic") || lower.includes("caustic soda") ||
    lower.includes("sodium hydroxide") || lower.includes("potassium hydroxide") ||
    lower.includes("hydrochloric acid") || lower.includes("sulphuric acid") ||
    lower.includes("sulfuric acid") || lower.includes("nitric acid") ||
    lower.includes("phosphoric acid") || lower.includes("acetic acid") ||
    lower.includes("citric acid") || lower.includes("hydrogen peroxide") ||
    lower.includes("ammonia") || lower.includes("urea solution") ||
    lower.includes("methanol") || lower.includes("ethanol") ||
    lower.includes("isopropyl alcohol") || lower.includes("ipa") ||
    lower.includes("acetone") || lower.includes("benzene") ||
    lower.includes("toluene") || lower.includes("xylene") ||
    lower.includes("phenol") || lower.includes("formaldehyde") ||
    lower.includes("chlorine") || lower.includes("bleaching powder") ||
    lower.includes("soda ash") || lower.includes("sodium carbonate") ||
    lower.includes("epoxy resin") || lower.includes("resin") ||
    lower.includes("adhesive") || lower.includes("solvent") ||
    lower.includes("lubricant") || lower.includes("grease") ||
    lower.includes("coolant") || lower.includes("flux") ||
    lower.includes("detergent") || lower.includes("surfactant") ||
    lower.includes("binder") || lower.includes("paint thinner") ||
    lower.includes("ferric chloride") || lower.includes("carbon powder")
  ) {
    return "chemicals";
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

  // ── Glass (MASTER MAPPING) ────────────────────────────────────────────────
  if (
    lower.includes("glass") || lower.includes("flat glass") ||
    lower.includes("float glass") || lower.includes("toughened glass") ||
    lower.includes("tempered glass") || lower.includes("laminated glass") ||
    lower.includes("glass sheet") || lower.includes("glass panel") ||
    lower.includes("glass bottle") || lower.includes("glass jar") ||
    lower.includes("glass container") || lower.includes("windshield glass") ||
    lower.includes("mirror") || lower.includes("fiberglass") ||
    lower.includes("fibreglass") || lower.includes("glass wool") ||
    lower.includes("borosilicate") || lower.includes("optical glass") ||
    lower.includes("safety glass") || lower.includes("architectural glass")
  ) {
    return "glass";
  }

  // ── Plastic (MASTER MAPPING) ──────────────────────────────────────────────
  if (
    lower.includes("plastic") || lower.includes("polymer") ||
    lower.includes("hdpe") || lower.includes("ldpe") ||
    lower.includes("lldpe") || lower.includes("pp") && lower.includes("resin") ||
    lower.includes("pvc") || lower.includes("abs resin") ||
    lower.includes("polycarbonate") || lower.includes("polypropylene") ||
    lower.includes("polyethylene") || lower.includes("pet resin") ||
    lower.includes("pet bottle") || lower.includes("pet preform") ||
    lower.includes("plastic sheet") || lower.includes("plastic bag") ||
    lower.includes("plastic bottle") || lower.includes("plastic container") ||
    lower.includes("plastic pipe") || lower.includes("plastic film") ||
    lower.includes("plastic cap") || lower.includes("plastic crate") ||
    lower.includes("plastic box") || lower.includes("plastic drum") ||
    lower.includes("plastic pallet") || lower.includes("plastic bucket") ||
    lower.includes("safety net") || lower.includes("shade net") ||
    lower.includes("fishing net") || lower.includes("monofilament") ||
    lower.includes("nylon rope") || lower.includes("foam") && lower.includes("plastic")
  ) {
    return "plastic";
  }

  // ── Paper & Packaging (MASTER MAPPING) ───────────────────────────────────
  if (
    lower.includes("paper") || lower.includes("kraft paper") ||
    lower.includes("copy paper") || lower.includes("office paper") ||
    lower.includes("recycled paper") || lower.includes("corrugated paper") ||
    lower.includes("corrugated") || lower.includes("corrugated box") ||
    lower.includes("cardboard") || lower.includes("carton") ||
    lower.includes("paperboard") || lower.includes("paper bag") ||
    lower.includes("paper cup") || lower.includes("paper plate") ||
    lower.includes("paper roll") || lower.includes("paper tube") ||
    lower.includes("tissue") || lower.includes("newsprint") ||
    lower.includes("packaging board") || lower.includes("duplex board") ||
    lower.includes("greyboard") || lower.includes("paper packaging") ||
    lower.includes("paper label") || lower.includes("paper sticker")
  ) {
    return "paper";
  }

  // ── Wood / Timber ────────────────────────────────────────────────────────
  if (
    lower.includes("wood") ||
    lower.includes("timber") ||
    lower.includes("plywood") ||
    lower.includes("mdf") ||
    lower.includes("flush door")
  ) {
    return "wood";
  }

  // ── Textile & Garments (MASTER MAPPING — 300+ keywords) ──────────────────
  // ── 1. Natural Fibres ────────────────────────────────────────────────────
  if (
    lower.includes("cotton") || lower.includes("organic cotton") || lower.includes("recycled cotton") ||
    lower.includes("linen") || lower.includes("flax") || lower.includes("hemp fibre") ||
    lower.includes("jute") || lower.includes("ramie") || lower.includes("bamboo fibre") ||
    lower.includes("silk") || lower.includes("raw silk") || lower.includes("silk thread") ||
    lower.includes("wool") || lower.includes("merino wool") || lower.includes("cashmere") ||
    lower.includes("alpaca") || lower.includes("mohair") || lower.includes("angora") ||
    lower.includes("natural fibre") || lower.includes("natural fiber")
  ) {
    return "textile";
  }

  // ── 2. Synthetic Fibres ─────────────────────────────────────────────────
  if (
    lower.includes("polyester fibre") || lower.includes("polyester fiber") ||
    lower.includes("recycled polyester") || lower.includes("pet fibre") ||
    lower.includes("polyamide") || lower.includes("acrylic fibre") ||
    lower.includes("polypropylene fibre") || lower.includes("polyethylene fibre") ||
    lower.includes("elastane") || lower.includes("spandex") || lower.includes("lycra") ||
    lower.includes("viscose fibre") || lower.includes("rayon fibre") ||
    lower.includes("modal fibre") || lower.includes("lyocell") || lower.includes("tencel") ||
    lower.includes("acetate fibre") || lower.includes("synthetic fibre") ||
    lower.includes("synthetic fiber") || lower.includes("man-made fibre")
  ) {
    return "textile";
  }

  // ── 3. Yarn ─────────────────────────────────────────────────────────────
  if (
    lower.includes("yarn") ||
    lower.includes("cotton yarn") || lower.includes("polyester yarn") ||
    lower.includes("blended yarn") || lower.includes("rayon yarn") ||
    lower.includes("viscose yarn") || lower.includes("nylon yarn") ||
    lower.includes("filament yarn") || lower.includes("textured yarn") ||
    lower.includes("spun yarn") || lower.includes("wool yarn") ||
    lower.includes("silk yarn") || lower.includes("melange yarn") ||
    lower.includes("fancy yarn") || lower.includes("dyed yarn") ||
    lower.includes("ring spun") || lower.includes("open end") || lower.includes("air jet yarn") ||
    lower.includes("count yarn") || lower.includes("dtex") || lower.includes("denier")
  ) {
    return "textile";
  }

  // ── 4. Fabrics ──────────────────────────────────────────────────────────
  if (
    lower.includes("fabric") || lower.includes("textile") || lower.includes("cloth") ||
    lower.includes("woven fabric") || lower.includes("knitted fabric") ||
    lower.includes("cotton fabric") || lower.includes("polyester fabric") ||
    lower.includes("blended fabric") || lower.includes("jersey") ||
    lower.includes("rib fabric") || lower.includes("interlock") ||
    lower.includes("fleece fabric") || lower.includes("canvas") || lower.includes("denim") ||
    lower.includes("twill") || lower.includes("poplin") || lower.includes("oxford fabric") ||
    lower.includes("linen fabric") || lower.includes("rayon fabric") ||
    lower.includes("viscose fabric") || lower.includes("satin") ||
    lower.includes("georgette") || lower.includes("crepe") || lower.includes("chiffon") ||
    lower.includes("velvet") || lower.includes("corduroy") || lower.includes("mesh fabric") ||
    lower.includes("lace fabric") || lower.includes("nonwoven") || lower.includes("non woven") ||
    lower.includes("technical textile") || lower.includes("stretch fabric") ||
    lower.includes("dobby") || lower.includes("jacquard") || lower.includes("flannel") ||
    lower.includes("muslin") || lower.includes("lawn") || lower.includes("voile") ||
    lower.includes("terry") || lower.includes("knit") || lower.includes("woven")
  ) {
    return "textile";
  }

  // ── 5. Garments ─────────────────────────────────────────────────────────
  if (
    lower.includes("garment") || lower.includes("apparel") || lower.includes("clothing") ||
    lower.includes("shirt") || lower.includes("tshirt") || lower.includes("t-shirt") ||
    lower.includes("t shirt") || lower.includes("jeans") || lower.includes("pant") ||
    lower.includes("trouser") || lower.includes("shorts") || lower.includes("hoodie") ||
    lower.includes("jacket") || lower.includes("coat") || lower.includes("dress") ||
    lower.includes("kurta") || lower.includes("salwar") || lower.includes("legging") ||
    lower.includes("tracksuit") || lower.includes("uniform") || lower.includes("overall") ||
    lower.includes("apron") || lower.includes("saree") || lower.includes("sari") ||
    lower.includes("blouse") || lower.includes("dupatta") || lower.includes("readymade") ||
    lower.includes("ready-made") || lower.includes("stitched") || lower.includes("cut and sew")
  ) {
    return "textile";
  }

  // ── 6. Home Textile ─────────────────────────────────────────────────────
  if (
    lower.includes("bedsheet") || lower.includes("bed sheet") || lower.includes("bed linen") ||
    lower.includes("blanket") || lower.includes("quilt") || lower.includes("comforter") ||
    lower.includes("curtain") || lower.includes("pillow cover") || lower.includes("pillow case") ||
    lower.includes("cushion cover") || lower.includes("towel") || lower.includes("bath towel") ||
    lower.includes("table cloth") || lower.includes("tablecloth") || lower.includes("napkin") ||
    lower.includes("kitchen towel") || lower.includes("mattress cover") ||
    lower.includes("duvet") || lower.includes("bed cover") ||
    lower.includes("home textile") || lower.includes("furnishing fabric")
  ) {
    return "textile";
  }

  // ── 7. Textile Accessories ─────────────────────────────────────────────
  if (
    lower.includes("sewing thread") || lower.includes("embroidery thread") ||
    lower.includes("zipper") || lower.includes("zip") || lower.includes("button") ||
    lower.includes("elastic tape") || lower.includes("elastic band") ||
    lower.includes("label") || lower.includes("hang tag") || lower.includes("price tag") ||
    lower.includes("velcro") || lower.includes("hook and eye") ||
    lower.includes("interlining") || lower.includes("interlinings") ||
    lower.includes("fusing") || lower.includes("shoulder pad") ||
    lower.includes("bias tape") || lower.includes("ribbon") || lower.includes("tassel")
  ) {
    return "textile";
  }

  // ── 8. Industrial Textile ──────────────────────────────────────────────
  if (
    lower.includes("geotextile") || lower.includes("geo textile") ||
    lower.includes("filter cloth") || lower.includes("filter fabric") ||
    lower.includes("woven sack") || lower.includes("pp bag") || lower.includes("pp woven") ||
    lower.includes("fiberglass fabric") || lower.includes("industrial fabric") ||
    lower.includes("agrotextile") || lower.includes("medical textile") ||
    lower.includes("tarpaulin") || lower.includes("tarp") ||
    lower.includes("shade cloth") || lower.includes("crop cover") ||
    lower.includes("conveyor belt fabric") || lower.includes("belting fabric")
  ) {
    return "textile";
  }

  // ── 9. Textile Chemicals ───────────────────────────────────────────────
  // Note: checked here BEFORE generic chemicals to avoid misclassification
  if (
    lower.includes("textile dye") || lower.includes("reactive dye") || lower.includes("disperse dye") ||
    lower.includes("vat dye") || lower.includes("pigment dye") || lower.includes("acid dye") ||
    lower.includes("fabric softener") || lower.includes("textile softener") ||
    lower.includes("bleaching agent") || lower.includes("optical brightener") ||
    lower.includes("textile finishing") || lower.includes("finishing agent") ||
    lower.includes("textile enzyme") || lower.includes("desizing agent") ||
    lower.includes("sizing agent") || lower.includes("starch size")
  ) {
    return "textile";
  }

  // ── 10. Footwear & Leather ────────────────────────────────────────────
  if (
    lower.includes("shoe") || lower.includes("footwear") ||
    lower.includes("slipper") || lower.includes("sandal") || lower.includes("boot") ||
    lower.includes("sports shoe") || lower.includes("leather shoe") ||
    lower.includes("synthetic leather") || lower.includes("pu leather") ||
    lower.includes("shoe sole") || lower.includes("insole") || lower.includes("upper") ||
    lower.includes("handbag") || lower.includes("wallet") || lower.includes("belt") ||
    lower.includes("leather goods") || lower.includes("leather product") ||
    lower.includes("genuine leather") || lower.includes("faux leather")
  ) {
    return "textile";
  }

  // ── Vendor Intelligence Final Fallback ────────────────────────────────
  // If vendor is identified as textile and item still unresolved,
  // classify as textile regardless of item name (handles SKU/design names)
  if (vendorIsTextile) {
    return "textile";
  }

  // ── Food & Beverage (MASTER MAPPING) ─────────────────────────────────────
  if (
    lower.includes("food") || lower.includes("beverage") ||
    lower.includes("flour") || lower.includes("atta") ||
    lower.includes("sugar") || lower.includes("salt") ||
    lower.includes("tea") || lower.includes("coffee") ||
    lower.includes("milk") || lower.includes("cheese") ||
    lower.includes("butter") || lower.includes("edible oil") ||
    lower.includes("mustard oil") || lower.includes("soybean oil") ||
    lower.includes("sunflower oil") || lower.includes("palm oil") ||
    lower.includes("chocolate") || lower.includes("cocoa") ||
    lower.includes("fruit juice") || lower.includes("soft drink") ||
    lower.includes("biscuit") || lower.includes("bread") ||
    lower.includes("bakery") || lower.includes("snacks") ||
    lower.includes("spice") || lower.includes("masala") ||
    lower.includes("processed food") || lower.includes("packaged food")
  ) {
    return "food";
  }

  // ── Agriculture (MASTER MAPPING) ──────────────────────────────────────────
  if (
    lower.includes("fertilizer") || lower.includes("fertiliser") ||
    lower.includes(" urea") || lower.includes("dap") || lower.includes("mop") ||
    lower.includes("npk") || lower.includes("potash") ||
    lower.includes("seed") || lower.includes("seeds") ||
    lower.includes("pesticide") || lower.includes("insecticide") ||
    lower.includes("fungicide") || lower.includes("herbicide") ||
    lower.includes("grain") || lower.includes("corn") ||
    lower.includes("maize") || lower.includes("soybean") ||
    lower.includes("sugarcane") || lower.includes("fodder") ||
    lower.includes("animal feed") || lower.includes("compost") ||
    lower.includes("crop") || lower.includes("harvest") ||
    lower.includes("irrigation") || lower.includes("agri")
  ) {
    return "agriculture";
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
    lower.includes("industrial water") ||
    lower.includes("raw water") ||
    lower.includes("process water") ||
    lower.includes("dm water") ||
    lower.includes("soft water") ||
    lower.includes("cooling water") ||
    lower.includes("water supply") ||
    lower.includes("water bill")
  ) {
    return "water";
  }

  // ── Freight / Logistics / Transport ──────────────────────────────────────
  if (
    lower.includes("freight") ||
    lower.includes("logistics") ||
    lower.includes("shipping") ||
    lower.includes("tonne-km") ||
    lower.includes("tkm") ||
    lower.includes("goods transport") ||
    lower.includes("truck transport") ||
    lower.includes("rail transport") ||
    lower.includes("sea freight") ||
    lower.includes("ocean freight") ||
    lower.includes("container") ||
    lower.includes("bulk carrier") ||
    lower.includes("barge") ||
    lower.includes("air freight") ||
    lower.includes("transport") ||
    lower.includes("vehicle") ||
    lower.includes("truck") ||
    lower.includes("lorry") ||
    lower.includes("cab") ||
    lower.includes("taxi")
  ) {
    return "transport"; // Combines freight/transport under transport umbrella
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


  // ── Electronics (MASTER MAPPING) ──────────────────────────────────────────
  if (
    lower.includes("pcb") || lower.includes("printed circuit") ||
    lower.includes("semiconductor") || lower.includes("microchip") ||
    lower.includes("sensor") || lower.includes("display") ||
    lower.includes("monitor") || lower.includes("television") ||
    lower.includes("laptop") || lower.includes("computer") ||
    lower.includes("printer") || lower.includes("server") ||
    lower.includes("router") || lower.includes("network switch") ||
    lower.includes("mobile phone") || lower.includes("smartphone") ||
    lower.includes("tablet") || lower.includes("hard disk") ||
    lower.includes("memory card") || lower.includes("ram") ||
    lower.includes("electronic component") || lower.includes("ic chip")
  ) {
    return "electronics";
  }

  // ── Automotive (MASTER MAPPING) ────────────────────────────────────────────
  if (
    lower.includes("engine") && (lower.includes("auto") || lower.includes("car") || lower.includes("truck") || lower.includes("vehicle")) ||
    lower.includes("gearbox") || lower.includes("clutch plate") ||
    lower.includes("brake pad") || lower.includes("brake disc") ||
    lower.includes("tyre") || lower.includes("tire") ||
    lower.includes("tube tyre") || lower.includes("auto part") ||
    lower.includes("radiator") || lower.includes("alternator") ||
    lower.includes("starter motor") || lower.includes("vehicle bearing") ||
    lower.includes("axle") || lower.includes("suspension") ||
    lower.includes("bumper") || lower.includes("windshield") ||
    lower.includes("vehicle seat") || lower.includes("car battery") ||
    lower.includes("engine oil") || lower.includes("gear oil")
  ) {
    return "automotive";
  }

  // ── Construction Materials (MASTER MAPPING) ────────────────────────────────
  if (
    lower.includes("brick") || lower.includes("fly ash brick") ||
    lower.includes("aac block") || lower.includes("concrete block") ||
    lower.includes("stone") || lower.includes("granite") ||
    lower.includes("marble") || lower.includes("tiles") ||
    lower.includes("ceramic tile") || lower.includes("vitrified tile") ||
    lower.includes("sand") || lower.includes("river sand") ||
    lower.includes("aggregate") || lower.includes("gravel") ||
    lower.includes("scaffolding") || lower.includes("roofing sheet") ||
    lower.includes("roofing tile") || lower.includes("putty") ||
    lower.includes("primer") || lower.includes("paint") ||
    lower.includes("wall putty") || lower.includes("plaster")
  ) {
    return "construction";
  }

  // ── Electrical equipment ──────────────────────────────────────────────────
  // Covers: chokes, ballasts, lamps, tube lights, LEDs, pumps, motors, panels,
  // fittings, switchgear, wires, cables, fans, ACs, inverters, transformers
  if (
    lower.includes("choke") ||
    lower.includes("ballast") ||
    lower.includes("lamp") ||
    lower.includes("luminaire") ||
    lower.includes("tube light") ||
    lower.includes("led") ||
    lower.includes("cfl") ||
    lower.includes("fitting") ||
    lower.includes("light fixture") ||
    lower.includes("bulb") ||
    lower.includes("electric pump") ||
    lower.includes("submersible pump") ||
    lower.includes("motor") ||
    lower.includes("switchgear") ||
    lower.includes("switchboard") ||
    lower.includes("mcb") ||
    lower.includes("mccb") ||
    lower.includes("rccb") ||
    lower.includes("circuit breaker") ||
    lower.includes("transformer") ||
    lower.includes("inverter") ||
    lower.includes("ups") ||
    lower.includes("cable") ||
    lower.includes("wire") ||
    lower.includes("conduit") ||
    lower.includes("panel") ||
    lower.includes("distribution board") ||
    lower.includes("fan") ||
    lower.includes("exhaust") ||
    lower.includes("air conditioner") ||
    lower.includes("ac unit") ||
    lower.includes("capacitor") ||
    lower.includes("contactor") ||
    lower.includes("relay") ||
    lower.includes("electric meter") ||
    lower.includes("energy meter") ||
    lower.includes("electronic component") ||
    lower.includes("rectifier") ||
    lower.includes("adaptor") ||
    lower.includes("socket") ||
    lower.includes("plug") ||
    lower.includes("switch")
  ) {
    return "electrical";
  }

  // ── Wood & Timber ──────────────────────────────────────────────────────────
  if (
    // 1. Raw Timber
    lower.includes("timber") ||
    lower.includes("wood") ||
    lower.includes("logs") ||
    lower.includes("log") ||
    lower.includes("roundwood") ||
    lower.includes("softwood") ||
    lower.includes("hardwood") ||
    lower.includes("firewood") ||
    lower.includes("wood chips") ||
    lower.includes("wood pellets") ||
    lower.includes("wood residue") ||
    lower.includes("wood waste") ||
    lower.includes("wood fuel") ||
    // 2. Lumber
    lower.includes("lumber") ||
    lower.includes("sawn timber") ||
    lower.includes("sawn wood") ||
    lower.includes("sawnwood") ||
    lower.includes("wood plank") ||
    lower.includes("plank") ||
    lower.includes("wood board") ||
    lower.includes("boards") ||
    lower.includes("beam") ||
    lower.includes("joist") ||
    lower.includes("stud") ||
    lower.includes("batten") ||
    lower.includes("wood section") ||
    // 3. Engineered Wood
    lower.includes("plywood") ||
    lower.includes("marine plywood") ||
    lower.includes("blockboard") ||
    lower.includes("particle board") ||
    lower.includes("chipboard") ||
    lower.includes("mdf") ||
    lower.includes("hdf") ||
    lower.includes("hardboard") ||
    lower.includes("osb") ||
    lower.includes("laminated timber") ||
    lower.includes("glulam") ||
    lower.includes("lvl") ||
    lower.includes("veneer") ||
    lower.includes("wood panel") ||
    // 4. Joinery Products
    lower.includes("door") ||
    lower.includes("door shutter") ||
    lower.includes("wooden door") ||
    lower.includes("flush door") ||
    lower.includes("panel door") ||
    lower.includes("door frame") ||
    lower.includes("door jamb") ||
    lower.includes("window") ||
    lower.includes("window frame") ||
    lower.includes("wood frame") ||
    lower.includes("cabinet") ||
    lower.includes("wardrobe") ||
    lower.includes("cupboard") ||
    lower.includes("drawer") ||
    lower.includes("shelf") ||
    // 5. Furniture
    lower.includes("table") ||
    lower.includes("chair") ||
    lower.includes("desk") ||
    lower.includes("bed") ||
    lower.includes("sofa") ||
    lower.includes("bench") ||
    lower.includes("stool") ||
    lower.includes("furniture") ||
    lower.includes("wood furniture") ||
    lower.includes("office furniture") ||
    // 6. Flooring
    lower.includes("flooring") ||
    lower.includes("wood flooring") ||
    lower.includes("parquet") ||
    lower.includes("laminate flooring") ||
    lower.includes("decking") ||
    lower.includes("wood deck") ||
    // 7. Packaging
    lower.includes("pallet") ||
    lower.includes("crate") ||
    lower.includes("box") ||
    lower.includes("wood box") ||
    lower.includes("packing case") ||
    lower.includes("wood packaging") ||
    lower.includes("packing timber") ||
    // 8. Construction Timber
    lower.includes("construction timber") ||
    lower.includes("structural timber") ||
    lower.includes("treated timber") ||
    lower.includes("framing timber") ||
    lower.includes("roof timber") ||
    lower.includes("scaffold board") ||
    // 9. Bamboo
    lower.includes("bamboo") ||
    lower.includes("bamboo board") ||
    lower.includes("bamboo plywood") ||
    // 10. Paper Pulp
    lower.includes("pulp") ||
    lower.includes("wood pulp") ||
    lower.includes("kraft pulp") ||
    lower.includes("paper pulp")
  ) {
    return "wood";
  }

  // Fallback for textile vendor with specific units
  if (vendorIsTextile && unit) {
    const u = unit.toLowerCase();
    if (u.includes("pcs") || u.includes("mtr") || u.includes("meter") || u.includes("roll") || u.includes("kg")) {
      return "textile";
    }
  }

  return "unknown";
}
