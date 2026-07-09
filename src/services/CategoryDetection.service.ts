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
    if (v.includes("textile") || v.includes("fabric") || v.includes("yarn") || v.includes("weaving") || v.includes("knitting") || v.includes("garment")) {
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

  // ── Industrial Chemicals ─────────────────────────────────────────────────
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
    lower.includes("carbon powder") ||
    lower.includes("binder") ||
    lower.includes("lubricant") ||
    lower.includes("flux oil")
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
    lower.includes("pet resin") ||
    lower.includes("safety net") ||
    lower.includes("shade net") ||
    lower.includes("fishing net") ||
    lower.includes("nylon") ||
    lower.includes("monofilament")
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

  // ── Textile & Garments (MASTER MAPPING) ──────────────────────────────────
  if (
    vendorIsTextile ||
    lower.includes("textile") || lower.includes("fabric") || lower.includes("cloth") ||
    lower.includes("cotton") || lower.includes("polyester") || lower.includes("garment") ||
    lower.includes("apparel") || lower.includes("yarn") ||
    lower.includes("nylon") || lower.includes("acrylic") || lower.includes("wool") ||
    lower.includes("merino wool") || lower.includes("silk") || lower.includes("viscose") ||
    lower.includes("rayon") || lower.includes("linen") || lower.includes("hemp") ||
    lower.includes("jute") || lower.includes("bamboo fibre") || lower.includes("modal") ||
    lower.includes("lyocell") || lower.includes("spandex") || lower.includes("elastane") ||
    lower.includes("cashmere") || lower.includes("denim") || lower.includes("canvas") ||
    lower.includes("jersey") || lower.includes("fleece") || lower.includes("satin") ||
    lower.includes("t shirt") || lower.includes("shirt") || lower.includes("jeans") ||
    lower.includes("pant") || lower.includes("trouser") || lower.includes("shorts") ||
    lower.includes("hoodie") || lower.includes("jacket") || lower.includes("coat") ||
    lower.includes("dress") || lower.includes("kurta") || lower.includes("saree") ||
    lower.includes("uniform") || lower.includes("apron") || lower.includes("gloves") ||
    lower.includes("cap") || lower.includes("bedsheet") || lower.includes("pillow cover") ||
    lower.includes("curtain") || lower.includes("blanket") || lower.includes("quilt") ||
    lower.includes("towel") || lower.includes("carpet") || lower.includes("rug") ||
    lower.includes("cushion") || lower.includes("mattress cover") || lower.includes("zipper") ||
    lower.includes("button") || lower.includes("thread") || lower.includes("elastic") ||
    lower.includes("lace") || lower.includes("label") || lower.includes("tape") ||
    lower.includes("interlining") || lower.includes("shoe") || lower.includes("boot") ||
    lower.includes("slipper") || lower.includes("belt") || lower.includes("wallet") ||
    lower.includes("handbag") || lower.includes("leather") || lower.includes("geotextile") ||
    lower.includes("filter cloth") || lower.includes("rope") || lower.includes("woven sack") ||
    lower.includes("knitted") || lower.includes("woven")
  ) {
    return "textile";
  }

  // ── Food & Agriculture ───────────────────────────────────────────────────
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


  // ── Chemicals ──────────────────────────────────────────────────────────────
  if (
    lower.includes("chemical") ||
    lower.includes("acid") ||
    lower.includes("alkali") ||
    lower.includes("solvent") ||
    lower.includes("caustic") ||
    lower.includes("caustic soda") ||
    lower.includes("sodium hydroxide")
  ) {
    return "chemicals";
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
