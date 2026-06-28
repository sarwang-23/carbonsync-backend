import db from "../db.js";

// ── In-memory cache (10x faster repeat lookups) ─────────────────────────────
const mappingCache = new Map<string, any>();

function getCached(key: string) {
  return mappingCache.get(key);
}

function setCache(key: string, value: any) {
  mappingCache.set(key, value);
}

// ── Smart Scoring Engine ─────────────────────────────────────────────────────
function calculateScore(itemName: string, row: any, country: string): number {
  const input = itemName.toLowerCase();

  const pattern   = String(row.pattern   || "").toLowerCase();
  const category  = String(row.category  || "").toLowerCase();
  const material  = String(row.material  || "").toLowerCase();
  const rowRegion = String(row.requested_region || row.region || "").toLowerCase();
  const keywords  = Array.isArray(row.item_keywords) ? row.item_keywords.join(" ").toLowerCase() : "";

  let score = 0;

  // 1. Direct keyword / pattern match (HIGH priority)
  if (input.includes("electricity") && (pattern.includes("electricity") || keywords.includes("electricity"))) score += 50;
  if (input.includes("diesel")      && (pattern.includes("diesel")      || keywords.includes("diesel")))      score += 50;
  if (input.includes("petrol")      && (pattern.includes("petrol")      || keywords.includes("petrol")))      score += 50;
  if (input.includes("natural gas") && (pattern.includes("natural gas") || keywords.includes("natural gas"))) score += 50;
  if (input.includes("kwh")         && (pattern.includes("kwh")         || keywords.includes("kwh")))         score += 30;
  if (input.includes("litre")       && (pattern.includes("litre")       || keywords.includes("litre")))       score += 20;
  if (input.includes("kg")          && (pattern.includes("kg")          || keywords.includes("kg")))          score += 10;

  // 2. Category match
  if (category && input.includes(category)) score += 20;

  // 3. Material match
  if (material && input.includes(material)) score += 20;

  // 4. Keyword array partial match (for any keyword in item_keywords)
  if (Array.isArray(row.item_keywords)) {
    for (const kw of row.item_keywords) {
      if (input.includes(String(kw).toLowerCase())) {
        score += 15;
        break;
      }
    }
  }

  // 5. Region boost – prefer requested country
  const countryLower = country.toLowerCase();
  if (
    rowRegion === countryLower ||
    rowRegion.includes(countryLower) ||
    String(row.country || "").toLowerCase() === countryLower
  ) {
    score += 15;
  }

  // 6. Priority column boost (legacy column – may or may not exist)
  score += Number(row.priority || 0);

  // 7. Penalise very generic / fallback rows slightly
  if (row.is_default === false) score -= 5;

  return score;
}

// ── Main Mapping Function ────────────────────────────────────────────────────
export async function findBestMapping(
  itemName: string,
  country: string = "Malaysia",
  region?: string
) {
  const cleanItem = String(itemName || "").toLowerCase().trim();
  const cacheKey  = `${cleanItem}__${country}__${region || "none"}`;

  // Return cached result instantly
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Fetch ALL rows that have at least one matching keyword (broad pre-filter)
  // If DB grows very large, add: WHERE array_length(item_keywords, 1) > 0
  const result = await db.query(
    `
    SELECT *
    FROM public.emission_factor_mappings
    WHERE EXISTS (
        SELECT 1 FROM unnest(item_keywords) kw WHERE LOWER($1) ~ kw
      )
    `,
    [cleanItem]
  );

  // If no keyword match at all, fall back to full table scan with scoring
  let rows = result.rows;
  if (rows.length === 0) {
    const allResult = await db.query(`SELECT * FROM public.emission_factor_mappings`);
    rows = allResult.rows;
  }

  // Run scoring engine across every candidate row
  let bestRow: any  = null;
  let bestScore     = -1;

  for (const row of rows) {
    const score = calculateScore(cleanItem, row, country);
    if (score > bestScore) {
      bestScore = score;
      bestRow   = row;
    }
  }

  // ── Debug: top candidates with scores ──────────────────────────────────
  const top5 = rows
    .map((row) => ({ activity_id: row.activity_id, region: row.requested_region, score: calculateScore(cleanItem, row, country) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  console.log("🏆 BEST MATCH:", {
    item: cleanItem,
    country,
    winner: { activity_id: bestRow?.activity_id, region: bestRow?.requested_region, score: bestScore },
    top5,
  });

  if (!bestRow) return null;

  // Build normalised mapping object
  const finalMapping = {
    ...bestRow,
    activity_id:      bestRow.activity_id,
    requested_region: bestRow.requested_region || bestRow.region || country,
    parameter_name:   bestRow.parameter_name  || (
      bestRow.unit_type?.toLowerCase().includes("energy") ? "energy" : null
    ),
    data_version:     bestRow.data_version    || "^6",
    _score:           bestScore,   // expose score for debugging / audit
  };

  // Cache and return
  setCache(cacheKey, finalMapping);
  return finalMapping;
}

// ── Utility: calculate emission from a local fallback factor ─────────────────
export function calculateEmission(quantity: number, mapping: any) {
  const factor = Number(mapping.fallback_factor_kgco2e_per_unit || 0);

  return {
    emission_factor: factor,
    total_kgco2e:    quantity * factor,
    total_tco2e:     (quantity * factor) / 1000,
    unit:            mapping.fallback_unit,
  };
}