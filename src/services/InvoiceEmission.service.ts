import { calculateGermanyEmission } from "./GermanyEmission.service.js";
import { calculateIndiaEmission } from "./IndiaEmission.service.js";
import { calculateWithClimatiqFallback } from "./ClimatiqFallback.service.js";
import { normalizeUnit } from "./UnitConversion.service.js";
import { pool } from "../db.js";
import { smartRailLookup } from "./IndiaRailwayRouteDB.js";

type InvoiceEmissionItem = {
  item_name: string;
  category: string;
  value: number;
  unit: string;
};

type ProcessInvoiceEmissionInput = {
  region: string;
  country_name: string;
  invoice_year?: number | null;
  invoice_text?: string;   // full raw PDF text — used for AU state detection
  items: InvoiceEmissionItem[];
};

/**
 * Detect Australian state from any text source.
 * Checks in priority order:
 *   1. Explicit state name / abbreviation
 *   2. AU electricity network distributor name
 *   3. Fallback: address keywords ("supply address", "service address", etc.)
 */
function getAustraliaStateKeyword(text: string): string | null {
  const t = text.toLowerCase();

  // ── 1. Explicit state name or abbreviation ─────────────────────────────────
  if (t.includes("victoria") || /\bvic\b/.test(t)) return "victoria";
  if (t.includes("new south wales") || /\bnsw\b/.test(t)) return "new south wales";
  if (t.includes("australian capital territory") || /\bact\b/.test(t)) return "australian capital territory";
  if (t.includes("queensland") || /\bqld\b/.test(t)) return "queensland";
  if (t.includes("south australia") || /\bsa\b/.test(t)) return "south australia";
  if (t.includes("western australia") || /\bwa\b/.test(t)) return "western australia";
  if (t.includes("tasmania") || /\btas\b/.test(t)) return "tasmania";
  if (t.includes("northern territory") || /\bnt\b/.test(t)) return "northern territory";

  // ── 2. AU electricity network / distributor name → state ──────────────────
  // VIC distributors
  if (
    t.includes("powercor") ||
    t.includes("citipower") ||
    t.includes("united energy") ||
    t.includes("ausnet") ||
    t.includes("jemena electricity")
  ) return "victoria";

  // NSW distributors
  if (
    t.includes("ausgrid") ||
    t.includes("endeavour energy") ||
    t.includes("essential energy")
  ) return "new south wales";

  // QLD distributors
  if (t.includes("energex") || t.includes("ergon energy")) return "queensland";

  // WA distributors
  if (t.includes("western power") || t.includes("synergy") || t.includes("horizon power")) return "western australia";

  // SA distributors
  if (t.includes("sa power networks") || t.includes("sapn")) return "south australia";

  // TAS distributors
  if (t.includes("aurora energy") || t.includes("tasnetworks")) return "tasmania";

  // NT distributors
  if (t.includes("power and water") || t.includes("power water")) return "northern territory";

  // ACT distributors
  if (t.includes("actew") || t.includes("evoenergy")) return "australian capital territory";

  // ── 3. Address-context extraction (supply/service/meter address) ───────────
  //    Scan lines that contain address keywords and look for state on same line
  const addressLineRegex =
    /(supply address|service address|meter address|customer address|site address|installation address)[^\n]*([\s\S]{0,120})/gi;
  let match: RegExpExecArray | null;
  while ((match = addressLineRegex.exec(t)) !== null) {
    const segment = match[0];
    if (segment.includes("victoria") || /\bvic\b/.test(segment)) return "victoria";
    if (segment.includes("new south wales") || /\bnsw\b/.test(segment)) return "new south wales";
    if (segment.includes("australian capital territory") || /\bact\b/.test(segment)) return "australian capital territory";
    if (segment.includes("queensland") || /\bqld\b/.test(segment)) return "queensland";
    if (segment.includes("south australia") || /\bsa\b/.test(segment)) return "south australia";
    if (segment.includes("western australia") || /\bwa\b/.test(segment)) return "western australia";
    if (segment.includes("tasmania") || /\btas\b/.test(segment)) return "tasmania";
    if (segment.includes("northern territory") || /\bnt\b/.test(segment)) return "northern territory";
  }

  return null;
}


function getUKFlightTypeKeyword(text: string): string | null {
  const t = text.toLowerCase();
  
  // List of major UK cities/airports
  const ukCities = ["london", "manchester", "edinburgh", "glasgow", "birmingham", "belfast", "bristol", "liverpool", "leeds", "newcastle", "aberdeen", "southampton"];
  
  let ukCityCount = 0;
  for (const city of ukCities) {
    if (t.includes(city)) {
      ukCityCount++;
    }
  }
  
  if (ukCityCount >= 2 || (ukCityCount === 1 && t.includes("domestic"))) {
    return "domestic";
  }
  
  if (t.includes("international") || t.includes("short-haul") || t.includes("long-haul") || t.includes("overseas")) {
    return "international";
  }
  
  return null;
}

function getActivityUnitFromFactorUnit(factorUnit: string) {
  const unit = normalizeUnit(factorUnit);

  // examples:
  // kg/litre -> litre
  // kg/scf -> scf
  // kg/short ton -> short ton
  // kgCO2e/kWh -> kWh
  if (unit.includes("/")) {
    return normalizeUnit(unit.split("/").pop() || "");
  }

  return unit;
}

function areUnitsSame(inputUnit: string, factorUnit: string) {
  const input = normalizeUnit(inputUnit);
  const activityUnit = getActivityUnitFromFactorUnit(factorUnit);

  return input === activityUnit;
}

async function findLocalOfficialFactor(params: {
  region: string;
  category: string;
  unit: string;
  itemName: string;
  description?: string;
  invoiceText?: string;    // full raw invoice text for AU state detection
}) {
  const normalizedInputUnit = normalizeUnit(params.unit);

  // AU electricity: combine all available text for best state detection
  // Priority: item_name → description → full invoice text (address/distributor fallback)
  const stateSearchText = [
    params.itemName,
    params.description,
    params.invoiceText,
  ].filter(Boolean).join(" ");

  const auState = params.region === "AU" && params.category === "electricity"
    ? getAustraliaStateKeyword(stateSearchText)
    : null;

  const ukFlightType = params.region === "GB" && (params.category.toLowerCase().includes("flight") || params.itemName.toLowerCase().includes("flight"))
    ? getUKFlightTypeKeyword(stateSearchText)
    : null;

  console.log("AU STATE DETECTED:", auState, "| region:", params.region, "| category:", params.category);
  console.log("UK FLIGHT TYPE:", ukFlightType);

  const result = await pool.query(
    `
    select
      factor_id,
      activity_id,
      name,
      category,
      region,
      source,
      source_dataset,
      source_lca_activity,
      year,
      unit,
      factor,
      scopes,
      constituent_gases,
      additional_indicators
    from official_emission_factors
    where region = $1
      and is_active = true
      and factor is not null
      and (
        lower(category) = lower($2)
        -- US EPA uses category names like 'Natural Gas', 'Petroleum Products', 'Coal and Coke'
        -- map our internal category keys to those official category names
        or (
          lower($2) = 'natural_gas'
          and lower(category) in ('natural gas', 'natural_gas')
        )
        or (
          lower($2) = 'petrol'
          and lower(category) in ('petroleum products')
          and lower(name) not like '%aviation%'
          and lower(name) not like '%lpg%'
          and lower(name) not like '%diesel%'
        )
        or (
          lower($2) = 'diesel'
          and (
            lower(name) like '%distillate fuel oil%'
            or lower(name) like '%diesel%'
            -- French ADEME names for diesel
            or lower(name) like '%gazole%'
            or lower(name) like '%gasoil%'
            or lower(name) like '%gazole routier%'
            or lower(name) like '%diesel oil%'
          )
        )
        or (
          lower($2) = 'lpg'
          and lower(category) in ('petroleum products')
          and (lower(name) like '%lpg%' or lower(name) like '%liquefied petroleum%')
        )
        or (
          lower($2) = 'coal'
          and lower(category) in ('coal and coke', 'coal')
        )
        or lower(name) like '%' || lower($2) || '%'
        or lower($2) = any(select lower(unnest(keywords)))
      )
    order by
      (
        (case when $5 = 'victoria' and lower(name) like '%victoria%' then 200
              when $5 = 'new south wales' and lower(name) like '%new south wales%' then 200
              when $5 = 'australian capital territory' and lower(name) like '%australian capital territory%' then 200
              when $5 = 'queensland' and lower(name) like '%queensland%' then 200
              when $5 = 'south australia' and lower(name) like '%south australia%' then 200
              when $5 = 'western australia' and lower(name) like '%western australia%' then 200
              when $5 = 'tasmania' and lower(name) like '%tasmania%' then 200
              when $5 = 'northern territory' and lower(name) like '%northern territory%' then 200
              else 0 end)
        + (case when lower(category) = lower($2) then 20 else 0 end)
        + (case when lower(unit) like '%/' || lower($4) then 50 else 0 end)
        + (case when lower($4) = 'tonne-km' and lower(unit) like '%/tonne-km%' then 50 else 0 end)
        + (case when lower($4) = 'gj' and lower(unit) like '%/gj%' then 50 else 0 end)
        + (case when lower($4) = 'm3' and lower(unit) like '%/m3%' then 50 else 0 end)
        
        + (case when lower($3) like '%black coal%' and lower(name) like '%black coal%' then 100
                when lower($3) like '%brown coal%' and lower(name) like '%brown coal%' then 100
                when lower($3) like '%sub-bituminous%' and lower(name) like '%sub-bituminous%' then 100
                when lower($3) like '%bituminous%' and lower($3) not like '%sub-bituminous%' and lower(name) = 'bituminous' then 100
                when lower($3) like '%anthracite%' and lower(name) like '%anthracite%' then 100
                when lower($3) like '%lignite%' and lower(name) like '%lignite%' then 100
                when lower($3) like '%coal coke%' and lower(name) like '%coal coke%' then 100
                when lower($3) like '%coal%' and lower(name) like '%coal coke%' then -50
                else 0 end)

        + (case when lower(name) like '%combustion%' or lower(source_lca_activity) like '%combustion%' then 100 else 0 end)
        + (case when lower(scopes::text) like '%scope 1%' or lower(scopes::text) like '%scope1%' or lower(name) like '%scope 1%' then 80 else 0 end)
        + (case when lower(scopes::text) like '%scope 2%' or lower(scopes::text) like '%scope2%' or lower(name) like '%scope 2%' then 70 else 0 end)
        + (case when lower(name) like '%location based%' or lower(name) like '%location-based%' then 60 else 0 end)
        + (case when lower(name) like '%market based%' or lower(name) like '%market-based%' then 55 else 0 end)
        
        + (case when lower(name) like '%outside of scopes%' or lower(scopes::text) like '%outside%' then -200 else 0 end)
        + (case when lower($2) like '%electricity%' and (lower(name) like '%coal%' or lower(name) like '%gas%' or lower(name) like '%nuclear%') then -150 else 0 end)
        + (case when lower($2) like '%electricity%' and lower(name) like '%generation%' and name != 'Electricity: UK - Electricity generated' then -80 else 0 end)
        + (case when lower(name) like '%wtt%' or lower(name) like '%well to tank%' or lower(name) like '%well-to-tank%' then -50 else 0 end)
        + (case when lower(name) like '%upstream%' or lower(source_lca_activity) like '%upstream%' then -40 else 0 end)
        + (case when lower(name) like '%without rf%' then -40 else 0 end)
        + (case when lower(name) like '%with rf%' then 40 else 0 end)
        + (case when lower(name) like '%average passenger%' then 50 else 0 end)
        
        + (case when lower($2) like '%electricity%' and (lower(name) like '%grid%' or lower(name) like '%supplied%' or name = 'Electricity: UK - Electricity generated') then 150 else 0 end)
        + (case when lower($2) like '%electricity%' and (lower(name) like '%t&d%' or lower(name) like '%transmission%') then -150 else 0 end)
        
        + (case when lower($2) = 'diesel' and (lower(name) like '%no. 2%' or lower(name) like '%no 2%') then 100 else 0 end)
        + (case when lower($2) = 'diesel' and (lower($3) like '%no. 1%' or lower($3) like '%no.1%') and (lower(name) like '%no. 1%' or lower(name) like '%no 1%') then 200 else 0 end)
        -- Penalise biodiesel/biofuel unless invoice explicitly mentions it
        + (case when lower($2) = 'diesel'
                 and (lower(name) like '%biodiesel%' or lower(name) like '%biofuel%' or lower(name) like '%b100%')
                 and lower($3) not like '%biodiesel%' and lower($3) not like '%b100%' and lower($3) not like '%biofuel%'
                 then -200 else 0 end)
        -- Prefer plain diesel / distillate / gasoil names
        + (case when lower($2) = 'diesel' and (lower(name) like '%gasoil%' or lower(name) like '%gazole%' or lower(name) like '%diesel oil%' or lower(name) like '%diesel fuel%') then 80 else 0 end)
        -- Penalise marine/MDO diesel unless invoice explicitly mentions marine/ship
        + (case when lower($2) = 'diesel'
                 and (lower(name) like '%marine%' or lower(name) like '%mdo%' or lower(name) like '%maritime%' or lower(name) like '%fluvial%')
                 and lower($3) not like '%marine%' and lower($3) not like '%ship%' and lower($3) not like '%maritime%' and lower($3) not like '%bateau%'
                 then -250 else 0 end)
        -- Prefer routier (road) diesel over non-routier when invoice is plain diesel
        + (case when lower($2) = 'diesel' and lower(name) like '%routier%' then 60 else 0 end)
        
        + (case when (lower($2) like '%petrol%' or lower($3) like '%petrol%') and lower(name) = 'motor gasoline' then 200 else 0 end)
        + (case when (lower($2) like '%petrol%' or lower($3) like '%petrol%') and (lower(name) like '%motor spirit%' or lower(name) = 'petrol' or lower(name) like '%gasoline%') then 90 else 0 end)
        + (case when (lower($2) like '%petrol%' or lower($3) like '%petrol%') and lower(name) like '%petroleum gas%' then -150 else 0 end)
        + (case when (lower($2) like '%petrol%' or lower($3) like '%petrol%') and lower(name) like '%petroleum coke%' then -150 else 0 end)
        + (case when (lower($2) like '%petrol%' or lower($3) like '%petrol%') and lower(name) like '%aviation%' then -150 else 0 end)
        
        + (case when (lower($2) like '%freight%' or lower($3) like '%freight%') and lower($3) like '%road%' and (lower(name) like '%hgv%' or lower(name) like '%rigid%' or lower(name) like '%articulated%' or lower(name) like '%average freight%') then 150 else 0 end)
        + (case when (lower($2) like '%freight%' or lower($3) like '%freight%') and lower($3) like '%road%' and (lower(name) like '%van%' and lower($3) not like '%van%') then -50 else 0 end)
        + (case when lower($3) like '%van%' and lower(name) like '%van%' then 150 else 0 end)
        + (case when (lower($2) like '%freight%' or lower($3) like '%freight%') and lower($3) like '%road%' and (lower(name) like '%flight%' or lower(name) like '%air%' or lower(name) like '%aviation%') then -150 else 0 end)
        
        + (case when lower($2) like '%flight%' and $6 = 'domestic' and lower(name) like '%domestic%' then 150 else 0 end)
        + (case when lower($2) like '%flight%' and $6 = 'domestic' and (lower(name) like '%international%' or lower(name) like '%short-haul%' or lower(name) like '%long-haul%') then -150 else 0 end)
        + (case when lower($2) like '%flight%' and $6 = 'international' and lower(name) like '%domestic%' then -150 else 0 end)
      ) DESC,
      year desc nulls last
    limit 20
    `,
    [params.region, params.category, params.itemName, normalizedInputUnit, auState, ukFlightType]
  );

  const rows = result.rows || [];

  const exactUnit = rows.find((row) =>
    row.unit ? areUnitsSame(params.unit, row.unit) : false
  );

  return exactUnit || rows[0] || null;
}

function convertValueToFactorUnit(value: number, inputUnit: string, factorUnit: string) {
  const input = normalizeUnit(inputUnit);
  const activityUnit = getActivityUnitFromFactorUnit(factorUnit);

  if (input === activityUnit) {
    return {
      success: true,
      value,
      unit: activityUnit,
      converted: false,
    };
  }

  if (input === "kwh" && activityUnit === "scf") {
    // 1 kWh = 3412.14 BTU, 1 scf = 1037 BTU -> 1 kWh = 3.2904 scf
    return {
      success: true,
      value: value * 3.2904,
      unit: "scf",
      converted: true,
    };
  }

  // normalizeUnit("litre") = "l", normalizeUnit("gallon") = "gallon"
  if (input === "l" && activityUnit === "gallon") {
    // 1 litre = 0.264172 gallon
    return {
      success: true,
      value: value * 0.264172,
      unit: "gallon",
      converted: true,
    };
  }

  if (input === "gallon" && activityUnit === "l") {
    // 1 gallon = 3.78541 litre
    return {
      success: true,
      value: value * 3.78541,
      unit: "l",
      converted: true,
    };
  }

  // normalizeUnit("tonne") = "tonne", normalizeUnit("short ton") = "shorton"
  if (input === "tonne" && (activityUnit === "shorton" || activityUnit === "shortton")) {
    // 1 metric tonne = 1.10231 short ton
    return {
      success: true,
      value: value * 1.10231,
      unit: "short_ton",
      converted: true,
    };
  }

  if (input === "l" && activityUnit === "kl") {
    return {
      success: true,
      value: value / 1000,
      unit: "kl",
      converted: true,
    };
  }

  if (input === "kl" && activityUnit === "l") {
    return {
      success: true,
      value: value * 1000,
      unit: "l",
      converted: true,
    };
  }

  if (input === "kg" && activityUnit === "tonne") {
    return {
      success: true,
      value: value / 1000,
      unit: "tonne",
      converted: true,
    };
  }

  if (input === "tonne" && activityUnit === "kg") {
    return {
      success: true,
      value: value * 1000,
      unit: "kg",
      converted: true,
    };
  }

  // Liquid fuels: litre → tonne using standard density (for ADEME kgCO2e/tonne factors)
  // Diesel/Gazole density ~0.845 kg/L, Petrol/Essence ~0.740 kg/L, LPG ~0.540 kg/L
  if (input === "l" && (activityUnit === "t" || activityUnit === "tonne")) {
    const density = 0.000845; // diesel/gazole default (kg/L → tonne/L)
    return {
      success: true,
      value: value * density,
      unit: "tonne",
      converted: true,
    };
  }

  // ADEME TEP PCI (Tonne Equivalent Petrol, Lower Heating Value)
  // Diesel/Gazole: 1 litre ≈ 0.000854 tep PCI
  if (input === "l" && (factorUnit.toLowerCase().includes("tep"))) {
    const tepPerLitre = 0.000854;
    return {
      success: true,
      value: value * tepPerLitre,
      unit: "tep",
      converted: true,
    };
  }

  return {
    success: false,
    reason: "UNIT_MISMATCH",
    input_unit: inputUnit,
    factor_unit: factorUnit,
    normalized_input_unit: input,
    normalized_factor_activity_unit: activityUnit,
  };
}

function calculateWithLocalFactor(value: number, inputUnit: string, factor: any) {
  const factorValue = Number(factor.factor);
  const factorUnit = factor.unit;

  if (!Number.isFinite(value) || value <= 0) {
    return {
      success: false,
      reason: "INVALID_VALUE",
    };
  }

  if (!Number.isFinite(factorValue) || factorValue <= 0) {
    return {
      success: false,
      reason: "INVALID_FACTOR_VALUE",
    };
  }

  const conversion = convertValueToFactorUnit(value, inputUnit, factorUnit);

  if (!conversion.success) {
    return conversion; // contains UNIT_MISMATCH reason and units
  }

  return {
    success: true,
    co2e: conversion.value * factorValue,
    co2e_unit: "kg",
    converted: conversion.converted,
    converted_value: conversion.value,
    converted_unit: conversion.unit
  };
}

export async function processInvoiceEmissions(
  input: ProcessInvoiceEmissionInput
) {
  console.log("EMISSION INPUT REGION:", input.region);
  console.log("EMISSION INPUT COUNTRY:", input.country_name);
  console.log("EMISSION ITEMS:", input.items);

  const results: any[] = [];
  let totalCo2e = 0;
  let calculatedCount = 0;
  let reviewCount = 0;
  let failedCount = 0;
  let ignoredCount = 0;

  // Keywords that are definitively non-emission financial line items
  const NON_EMISSION_KEYWORDS = [
    "gst", "cgst", "sgst", "igst", "vat", "output vat", "input vat",
    "excise duty", "cess", "tcs", "tds",
    "discount", "round off", "rounding",
    "insurance",
    "packing charges", "packing",
  ];
  // Keywords where we ignore only if there is no usable quantity/value
  const CONDITIONAL_IGNORE_KEYWORDS = [
    "transportation", "transportation charges", "transport charges",
    "freight charges",
  ];

  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i] as any;
    try {
      const itemName =
        item.item_name ||
        item.name ||
        item.description ||
        "Unknown item";

      const category = item.category || "unknown";
      const value = Number(item.value || item.quantity);
      const unit = item.unit;
      const nameLower = itemName.toLowerCase();

      // ── Non-emission item check (tax, duty, discount, etc.) ───────────────
      if (NON_EMISSION_KEYWORDS.some(kw => nameLower.includes(kw))) {
        ignoredCount++;
        results.push({
          line_index: i,
          item_name: itemName,
          category,
          value,
          unit,
          status: "ignored",
          reason: "NON_EMISSION_ITEM",
          message: "This is a tax, duty, discount, or fee line — not an emission-producing activity.",
        });
        continue;
      }

      // ── Conditional ignore: transport/freight with no usable quantity ─────
      if (CONDITIONAL_IGNORE_KEYWORDS.some(kw => nameLower.includes(kw)) && (!value || !Number.isFinite(value) || value <= 0)) {
        ignoredCount++;
        results.push({
          line_index: i,
          item_name: itemName,
          category,
          value: null,
          unit,
          status: "ignored",
          reason: "TRANSPORT_INSUFFICIENT_DATA",
          message: "Transportation charge with no distance/weight/truck data — cannot calculate emission.",
        });
        continue;
      }

      console.log("ITEM ROUTING CHECK:", {
        region: input.region,
        category,
        value,
        unit,
      });

      // ── Railway: try deep rescue before giving up ────────────────────────
      if (category === "railway_review" || (category === "railway" && (unit === "ticket" || !value || value === 1))) {
        // Attempt 1: scan item_name / invoice_text for cities or km
        const searchText = `${itemName} ${item.description || ""} ${input.invoice_text || ""}`;

        // Inline distance extractor from item text
        const kmMatch = searchText.match(/(\d{3,4})\s*(?:km|kms|passenger[- ]?km|pkm)/i);
        if (kmMatch) {
          const distKm = Number(kmMatch[1]);
          const RAILWAY_EF = 0.007976;
          const co2e = Number((distKm * RAILWAY_EF).toFixed(6));
          calculatedCount++;
          totalCo2e += co2e;
          results.push({
            line_index: i,
            item_name: itemName,
            category: "railway",
            value: distKm,
            unit: "passenger-km",
            status: "calculated",
            source_engine: "india_fixed_ef",
            preferred_source: "India Fixed EF",
            region: "IN",
            country_name: "India",
            factor_name: "India fixed railway emission factor",
            factor_value: RAILWAY_EF,
            factor_unit: "kg/passenger-km",
            co2e,
            co2e_unit: "kg",
            distance_source: "text_extraction",
          });
          continue;
        }

        // Attempt 2: city-pair or station-code route DB lookup from item_name
        // Look for station codes (e.g. NDLS-MMCT) or cities
        const cityPattern = /\b([a-zA-Z]{2,15})\b\s*(?:to|[-_→])\s*\b([a-zA-Z]{2,15})\b/i;
        const match = searchText.match(cityPattern);
        if (match) {
          const origin = match[1];
          const destination = match[2];
          const dbResult = smartRailLookup(origin, destination);
          if (dbResult) {
            const RAILWAY_EF = 0.007976;
            const co2e = Number((dbResult.distanceKm * RAILWAY_EF).toFixed(6));
            calculatedCount++;
            totalCo2e += co2e;
            results.push({
              line_index: i,
              item_name: itemName,
              category: "railway",
              value: dbResult.distanceKm,
              unit: "passenger-km",
              status: "calculated",
              source_engine: "india_fixed_ef",
              preferred_source: "India Fixed EF",
              region: "IN",
              country_name: "India",
              factor_name: "India fixed railway emission factor",
              factor_value: RAILWAY_EF,
              factor_unit: "kg/passenger-km",
              co2e,
              co2e_unit: "kg",
              distance_source: dbResult.source,
              origin: origin.toUpperCase(),
              destination: destination.toUpperCase(),
            });
            continue;
          }
        }

        // No rescue possible
        reviewCount++;
        results.push({
          line_index: i,
          item_name: itemName,
          category: "railway",
          value,
          unit,
          status: "review",
          reason: "RAILWAY_DISTANCE_NOT_FOUND",
          message: "Railway ticket detected but distance could not be extracted. Please provide distance in km or passenger-km.",
        });
        continue;
      }

      if (!value || !Number.isFinite(value)) {
        reviewCount++;
        const isSteelOrGoods = category === "steel" || category === "purchased_goods" || itemName.toLowerCase().includes("steel");
        results.push({
          line_index: i,
          item_name: itemName,
          category,
          value,
          unit,
          status: "review",
          reason: isSteelOrGoods ? "QUANTITY_NOT_EXTRACTED" : "INVALID_VALUE",
          message: isSteelOrGoods 
            ? "Steel invoice detected but quantity/weight could not be extracted from the document."
            : "This item needs manual review or mapping update",
        });
        continue;
      }

      if (category === "unknown") {
        reviewCount++;
        results.push({
          line_index: i,
          item_name: itemName,
          category,
          value,
          unit,
          status: "review",
          reason: "UNKNOWN_CATEGORY",
          message: "This item needs manual review or mapping update",
        });
        continue;
      }

      if (category === "flight_review") {
        reviewCount++;
        results.push({
          line_index: i,
          item_name: itemName,
          category: "flight",
          value,
          unit,
          status: "review",
          reason: (item as any).metadata?.reason || "FLIGHT_DISTANCE_NOT_FOUND",
          message: "Flight ticket detected but airport pair/coordinates could not be extracted",
          metadata: (item as any).metadata || null,
        });
        continue;
      }

      // AU freight tonne-km: default factor (0.12 kg/tonne-km) seeded in official_emission_factors
      // Normal local DB lookup will find it — no special intercept needed

      // ── India ─── Hybrid Fixed EF + Climatiq Fallback route ──────────────────
      if (input.region === "IN") {
        console.log("USING INDIA FIXED/HYBRID ROUTE");

        const indiaResult = await calculateIndiaEmission({
          category,
          itemName,
          value,
          unit,
        });

        if (!indiaResult.success) {
          reviewCount++;

          results.push({
            line_index: i,
            item_name: itemName,
            category,
            value,
            unit,
            status: "review",
            source_engine: (indiaResult as any).source_engine || "india_hybrid",
            region: "IN",
            reason: (indiaResult as any).reason,
            message: (indiaResult as any).message,
            expected_factor_unit: (indiaResult as any).expected_factor_unit,
          });

          continue;
        }

        calculatedCount++;
        totalCo2e += (indiaResult as any).co2e;

        results.push({
          line_index: i,
          item_name: itemName,
          category,
          value,
          unit,
          status: "calculated",
          source_engine: (indiaResult as any).source_engine || (indiaResult as any).engine,
          preferred_source: (indiaResult as any).preferred_source || (indiaResult as any).source,
          region: "IN",
          country_name: "India",
          factor_name: (indiaResult as any).factor_name,
          factor_value: (indiaResult as any).factor_value,
          factor_unit: (indiaResult as any).factor_unit,
          source_dataset: (indiaResult as any).source_dataset,
          year: (indiaResult as any).year,
          activity_id: (indiaResult as any).activity_id,
          parameter_name: (indiaResult as any).parameter_name,
          parameter_unit: (indiaResult as any).parameter_unit,
          converted: (indiaResult as any).converted,
          co2e: (indiaResult as any).co2e,
          co2e_unit: (indiaResult as any).co2e_unit,
        });

        continue;
      }

      // ── Germany ─── UBA first, then Climatiq fallback ──────────────────────
      if (input.region === "DE") {
        try {
          const germanyResult = await calculateGermanyEmission({
            category: item.category,
            value: Number(item.value),
            unit: item.unit,
          });

          if (germanyResult.success) {
            // ✅ UBA mapping found → use it
            calculatedCount++;
            totalCo2e += germanyResult.co2e;
            results.push({
              item_name: item.item_name,
              category: item.category,
              value: item.value,
              unit: item.unit,
              status: "calculated",
              source_engine: "climatiq",
              preferred_source: "UBA",
              region: "DE",
              country_name: "Germany",
              activity_id: germanyResult.activity_id,
              parameter_name: germanyResult.parameter_name,
              parameter_unit: germanyResult.parameter_unit,
              co2e: germanyResult.co2e,
              co2e_unit: germanyResult.co2e_unit,
              factor_name: germanyResult.factor_name,
              factor_source: germanyResult.factor_source,
              factor_region: germanyResult.factor_region,
              converted: germanyResult.converted,
            });
            continue;
          }

          // ⚠️ No UBA mapping → try Climatiq fallback
          console.log(`[DE] No UBA mapping for category "${item.category}". Trying Climatiq fallback...`);

          const fallbackResult = await calculateWithClimatiqFallback({
            region: "DE",
            countryName: "Germany",
            category: item.category,
            itemName: item.item_name,
            value: Number(item.value),
            unit: item.unit,
          });

          if (!fallbackResult.success) {
            // Both UBA and Climatiq failed → review
            reviewCount++;
            results.push({
              item_name: item.item_name,
              category: item.category,
              value: item.value,
              unit: item.unit,
              status: "review",
              source_engine: "climatiq_fallback",
              region: "DE",
              reason: (fallbackResult as any).reason || "NO_CLIMATIQ_FALLBACK_MAPPING",
              message: (fallbackResult as any).message || "No UBA or Climatiq factor found for this item.",
            });
            continue;
          }

          // ✅ Climatiq fallback succeeded
          calculatedCount++;
          totalCo2e += fallbackResult.co2e;
          results.push({
            item_name: item.item_name,
            category: item.category,
            value: item.value,
            unit: item.unit,
            status: "calculated",
            source_engine: "climatiq",
            preferred_source: "Climatiq",
            region: "DE",
            country_name: "Germany",
            activity_id: fallbackResult.activity_id,
            parameter_name: fallbackResult.parameter_name,
            parameter_unit: fallbackResult.parameter_unit,
            converted: fallbackResult.converted,
            co2e: fallbackResult.co2e,
            co2e_unit: fallbackResult.co2e_unit,
            factor_name: fallbackResult.factor_name,
            factor_source: fallbackResult.factor_source,
            factor_region: fallbackResult.factor_region,
          });
        } catch (err: any) {
          reviewCount++;
          results.push({
            item_name: item.item_name,
            category: item.category,
            value: item.value,
            unit: item.unit,
            status: "review",
            source_engine: "climatiq",
            region: "DE",
            reason: "CLIMATIQ_ERROR",
            message: err.message || "Climatiq API call failed",
          });
        }
        continue;
      }

      // ── FR liquid fuels bypass ────────────────────────────────────────────────
      // ADEME Base Carbone stores Gazole/Essence/GPL in kgCO2e/litre ONLY as
      // "Amont" (upstream/WTT) partial factors (~0.3–1.2 kgCO2e/L).
      // Full combustion factors are only available in kgCO2e/tonne or kgCO2e/tep.
      // To avoid unit-conversion errors and wrong scope selection, FR liquid fuel
      // invoices go directly to Climatiq which has correct full-combustion factors.
      const FR_CLIMATIQ_DIRECT_CATEGORIES = ["diesel", "petrol", "lpg"];
      const normalizedItemUnit = normalizeUnit(item.unit);
      const isLiquidLitreInvoice = normalizedItemUnit === "l" || normalizedItemUnit === "litre";
      if (
        input.region === "FR" &&
        FR_CLIMATIQ_DIRECT_CATEGORIES.includes(item.category) &&
        isLiquidLitreInvoice
      ) {
        const fallbackResult = await calculateWithClimatiqFallback({
          region: input.region,
          countryName: input.country_name,
          category: item.category,
          itemName: item.item_name,
          value: Number(item.value),
          unit: item.unit,
        });

        if (!fallbackResult.success) {
          reviewCount++;
          results.push({
            item_name: item.item_name,
            category: item.category,
            value: item.value,
            unit: item.unit,
            status: "review",
            source_engine: "climatiq",
            region: input.region,
            reason: fallbackResult.reason || "CLIMATIQ_ESTIMATION_FAILED",
            message: fallbackResult.message || "No Climatiq factor found for this fuel.",
          });
          continue;
        }

        calculatedCount++;
        totalCo2e += fallbackResult.co2e;
        results.push({
          item_name: item.item_name,
          category: item.category,
          value: item.value,
          unit: item.unit,
          status: "calculated",
          source_engine: "climatiq",
          preferred_source: "Climatiq",
          region: input.region,
          country_name: input.country_name,
          activity_id: fallbackResult.activity_id,
          parameter_name: fallbackResult.parameter_name,
          parameter_unit: fallbackResult.parameter_unit,
          converted: fallbackResult.converted,
          co2e: fallbackResult.co2e,
          co2e_unit: fallbackResult.co2e_unit,
          factor_name: fallbackResult.factor_name,
          factor_source: fallbackResult.factor_source,
          factor_region: fallbackResult.factor_region,
        });
        continue;
      }

      // ── US / GB / FR / AU ─── local official_emission_factors DB route ─────
      const factor = await findLocalOfficialFactor({
        region: input.region,
        category: item.category,
        unit: item.unit,
        itemName: item.item_name,
        description: item.description,
        invoiceText: input.invoice_text,   // full PDF text for AU state fallback
      });

      if (!factor) {
        const fallbackResult = await calculateWithClimatiqFallback({
          region: input.region,
          countryName: input.country_name,
          category: item.category,
          itemName: item.item_name,
          value: Number(item.value),
          unit: item.unit,
        });

        if (!fallbackResult.success) {
          reviewCount++;

          results.push({
            item_name: item.item_name,
            category: item.category,
            value: item.value,
            unit: item.unit,
            status: "review",
            source_engine: "official_factor_db_then_climatiq",
            region: input.region,
            reason: fallbackResult.reason || "NO_FACTOR_FOUND",
            message: fallbackResult.message || "No official or Climatiq emission factor available.",
          });

          continue;
        }

        calculatedCount++;
        totalCo2e += fallbackResult.co2e;

        results.push({
          item_name: item.item_name,
          category: item.category,
          value: item.value,
          unit: item.unit,
          status: "calculated",
          source_engine: "climatiq",
          fallback_used: true,
          preferred_source: "Climatiq",
          region: input.region,
          country_name: input.country_name,
          activity_id: fallbackResult.activity_id,
          parameter_name: fallbackResult.parameter_name,
          parameter_unit: fallbackResult.parameter_unit,
          converted: fallbackResult.converted,
          co2e: fallbackResult.co2e,
          co2e_unit: fallbackResult.co2e_unit,
          factor_name: fallbackResult.factor_name,
          factor_source: fallbackResult.factor_source,
          factor_region: fallbackResult.factor_region,
        });

        continue;
      }

      const localCalc = calculateWithLocalFactor(
        Number(item.value),
        item.unit,
        factor
      );

      if (!localCalc.success) {
        // Fallback to Climatiq if official DB had a unit mismatch
        const fallbackResult = await calculateWithClimatiqFallback({
          itemName: item.item_name,
          category: item.category,
          value: Number(item.value),
          unit: item.unit,
          region: input.region,
          countryName: input.country_name,
        });

        if (fallbackResult.status === "review") {
          reviewCount++;
          results.push({
            item_name: item.item_name,
            category: item.category,
            value: item.value,
            unit: item.unit,
            status: "review",
            source_engine: "climatiq",
            fallback_used: true,
            region: input.region,
            country_name: input.country_name,
            reason: fallbackResult.reason || localCalc.reason || "UNIT_MISMATCH",
            message: fallbackResult.message || "Factor found but unit mismatch occurred. Climatiq fallback also failed.",
          });
          continue;
        }

        calculatedCount++;
        totalCo2e += fallbackResult.co2e || 0;

        results.push({
          item_name: item.item_name,
          category: item.category,
          value: item.value,
          unit: item.unit,
          status: "calculated",
          source_engine: "climatiq",
          fallback_used: true,
          preferred_source: "Climatiq",
          region: input.region,
          country_name: input.country_name,
          activity_id: fallbackResult.activity_id,
          parameter_name: fallbackResult.parameter_name,
          parameter_unit: fallbackResult.parameter_unit,
          converted: fallbackResult.converted,
          co2e: fallbackResult.co2e,
          co2e_unit: fallbackResult.co2e_unit,
          factor_name: fallbackResult.factor_name,
          factor_source: fallbackResult.factor_source,
          factor_region: fallbackResult.factor_region,
        });

        continue;
      }

      calculatedCount++;
      totalCo2e += (localCalc as any).co2e;

      results.push({
        item_name: item.item_name,
        category: item.category,
        value: item.value,
        unit: item.unit,
        status: "calculated",
        source_engine: "official_factor_db",
        region: input.region,
        country_name: input.country_name,
        factor_id: factor.factor_id,
        activity_id: factor.activity_id,
        factor_name: factor.name,
        factor_category: factor.category,
        factor_unit: factor.unit,
        factor_value: Number(factor.factor),
        source: factor.source,
        source_dataset: factor.source_dataset,
        source_lca_activity: factor.source_lca_activity,
        scopes: factor.scopes,
        co2e: (localCalc as any).co2e,
        co2e_unit: "kg",
        ...((localCalc as any).converted ? { 
          converted: { 
            value: (localCalc as any).converted_value, 
            unit: (localCalc as any).converted_unit 
          } 
        } : {})
      });
    } catch (error: any) {
      failedCount++;
      results.push({
        item_name: item.item_name,
        category: item.category,
        value: item.value,
        unit: item.unit,
        status: "failed",
        reason: "CALCULATION_ERROR",
        message: error.message,
      });
    }
  }

  return {
    success: failedCount === 0,
    region: input.region,
    country_name: input.country_name,
    total_items: input.items.length,
    calculated_count: calculatedCount,
    review_count: reviewCount,
    ignored_count: ignoredCount,
    failed_count: failedCount,
    total_co2e: Number(totalCo2e.toFixed(6)),
    total_co2e_unit: "kg",
    results,
  };
}
