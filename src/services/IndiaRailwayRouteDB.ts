/**
 * Static Indian railway route distance table.
 * Supports both:
 *   (a) Station code pairs: "NDLS-MMCT" → 1386 km
 *   (b) City name pairs:    "delhi-mumbai" → 1388 km
 *
 * Source: IRCTC approximate rail distances (major corridors).
 * Direction-insensitive: A→B and B→A return same distance.
 */

// ── Station code → distance (km by rail) ─────────────────────────────────────
const STATION_CODE_MAP: Record<string, number> = {
  // ── Delhi ↔ Mumbai corridors ─────────────────────────────────────────────
  "NDLS-MMCT": 1386, "NDLS-BCT": 1384, "NDLS-LTT": 1389,
  "NZM-MMCT": 1386,  "NZM-BCT": 1384,
  "DLI-MMCT": 1390,

  // ── Delhi ↔ Bihar (Muzaffarpur, Patna) ──────────────────────────────────
  "DLI-MFP": 1038, "NDLS-MFP": 1066, "ANVT-MFP": 1050,
  "NDLS-PNBE": 997, "NDLS-DNR": 1001,
  "NZM-PNBE": 1001,

  // ── Delhi ↔ Chennai ──────────────────────────────────────────────────────
  "NDLS-MAS": 2180, "NDLS-MS": 2176,
  "NZM-MAS": 2190,

  // ── Delhi ↔ Kolkata ──────────────────────────────────────────────────────
  "NDLS-HWH": 1450, "NDLS-SDAH": 1455,
  "NZM-HWH": 1460,

  // ── Delhi ↔ Bangalore ────────────────────────────────────────────────────
  "NDLS-SBC": 2444, "NDLS-YPR": 2448,
  "NZM-SBC": 2444,

  // ── Delhi ↔ Hyderabad ────────────────────────────────────────────────────
  "NDLS-SC": 1550, "NZM-SC": 1554,


  // ── Delhi ↔ Lucknow ──────────────────────────────────────────────────────
  "NDLS-LKO": 512, "NDLS-LJN": 506, "NZM-LKO": 516,

  // ── Delhi ↔ Varanasi ─────────────────────────────────────────────────────
  "NDLS-BSB": 820, "NDLS-MUV": 812,

  // ── Delhi ↔ Jaipur ───────────────────────────────────────────────────────
  "NDLS-JP": 303, "NZM-JP": 308,

  // ── Delhi ↔ Ahmedabad ────────────────────────────────────────────────────
  "NDLS-ADI": 942, "NZM-ADI": 942,

  // ── Delhi ↔ Bhubaneswar ──────────────────────────────────────────────────
  "NDLS-BBS": 1745, "NZM-BBS": 1750,

  // ── Delhi ↔ Guwahati ─────────────────────────────────────────────────────
  "NDLS-GHY": 1956, "NDLS-AGTL": 1842,

  // ── Delhi ↔ Amritsar ─────────────────────────────────────────────────────
  "NDLS-ASR": 449, "DLI-ASR": 449,

  // ── Delhi ↔ Chandigarh ───────────────────────────────────────────────────
  "NDLS-CDG": 244, "NDLS-UMB": 244,

  // ── Delhi ↔ Agra ─────────────────────────────────────────────────────────
  "NDLS-AGC": 200, "NZM-AGC": 195,

  // ── Delhi ↔ Kanpur ───────────────────────────────────────────────────────
  "NDLS-CNB": 440, "NZM-CNB": 440,

  // ── Delhi ↔ Prayagraj / Allahabad ────────────────────────────────────────
  "NDLS-PRYJ": 634, "NDLS-ALD": 643,

  // ── Delhi ↔ Nagpur ───────────────────────────────────────────────────────
  "NDLS-NGP": 1092,

  // ── Delhi ↔ Bhopal ───────────────────────────────────────────────────────
  "NDLS-BPL": 705,

  // ── Delhi ↔ Indore ───────────────────────────────────────────────────────
  "NDLS-INDB": 898,

  // ── Mumbai ↔ Pune ─────────────────────────────────────────────────────────
  "MMCT-PUNE": 192, "BCT-PUNE": 188, "LTT-PUNE": 191,

  // ── Mumbai ↔ Goa ──────────────────────────────────────────────────────────
  "MMCT-MAO": 582, "BCT-MAO": 578,

  // ── Mumbai ↔ Ahmedabad ────────────────────────────────────────────────────
  "MMCT-ADI": 492, "BCT-ADI": 490,

  // ── Mumbai ↔ Nagpur ───────────────────────────────────────────────────────
  "MMCT-NGP": 838, "BCT-NGP": 835,

  // ── Mumbai ↔ Hyderabad ────────────────────────────────────────────────────
  "MMCT-SC": 711, "BCT-SC": 706,

  // ── Mumbai ↔ Bangalore ────────────────────────────────────────────────────
  "MMCT-SBC": 1033, "BCT-SBC": 1030,

  // ── Mumbai ↔ Chennai ──────────────────────────────────────────────────────
  "MMCT-MAS": 1279, "BCT-MAS": 1275,

  // ── Mumbai ↔ Kolkata ──────────────────────────────────────────────────────
  "MMCT-HWH": 1969, "BCT-HWH": 1965,

  // ── Mumbai ↔ Surat ────────────────────────────────────────────────────────
  "MMCT-ST": 263, "BCT-ST": 264,

  // ── Chennai ↔ Bangalore ───────────────────────────────────────────────────
  "MAS-SBC": 362, "MAS-YPR": 358, "MS-SBC": 360,

  // ── Chennai ↔ Hyderabad ───────────────────────────────────────────────────
  "MAS-SC": 625, "MAS-HYB": 620,

  // ── Chennai ↔ Kolkata ─────────────────────────────────────────────────────
  "MAS-HWH": 1659,

  // ── Chennai ↔ Kochi ───────────────────────────────────────────────────────
  "MAS-ERS": 630, "MAS-TVC": 920,

  // ── Chennai ↔ Coimbatore ──────────────────────────────────────────────────
  "MAS-CBE": 501,

  // ── Chennai ↔ Madurai ─────────────────────────────────────────────────────
  "MAS-MDU": 456,

  // ── Chennai ↔ Visakhapatnam ───────────────────────────────────────────────
  "MAS-VSKP": 790,

  // ── Bangalore ↔ Hyderabad ─────────────────────────────────────────────────
  "SBC-SC": 574, "SBC-HYB": 574,

  // ── Bangalore ↔ Kochi ─────────────────────────────────────────────────────
  "SBC-ERS": 531,

  // ── Bangalore ↔ Mysore ────────────────────────────────────────────────────
  "SBC-MYS": 139, "YPR-MYS": 139,

  // ── Kolkata ↔ Patna ───────────────────────────────────────────────────────
  "HWH-PNBE": 563, "SDAH-PNBE": 567,

  // ── Kolkata ↔ Bhubaneswar ─────────────────────────────────────────────────
  "HWH-BBS": 440,

  // ── Kolkata ↔ Guwahati ────────────────────────────────────────────────────
  "HWH-GHY": 1008,

  // ── Kolkata ↔ Visakhapatnam ───────────────────────────────────────────────
  "HWH-VSKP": 1107,

  // ── Hyderabad ↔ Nagpur ────────────────────────────────────────────────────
  "SC-NGP": 504,

  // ── Hyderabad ↔ Vijayawada ────────────────────────────────────────────────
  "SC-BZA": 275,

  // ── Patna ↔ Varanasi ──────────────────────────────────────────────────────
  "PNBE-BSB": 248,

  // ── Lucknow ↔ Kanpur ──────────────────────────────────────────────────────
  "LKO-CNB": 65, "LJN-CNB": 65,

  // ── Nagpur ↔ Bhopal ───────────────────────────────────────────────────────
  "NGP-BPL": 359,

  // ── Raipur ↔ Nagpur ───────────────────────────────────────────────────────
  "R-NGP": 295, "BSP-NGP": 294,

  // ── Visakhapatnam ↔ Bhubaneswar ───────────────────────────────────────────
  "VSKP-BBS": 438,
};

// ── City name → distance (km by rail) ────────────────────────────────────────
const CITY_ROUTE_MAP: Record<string, number> = {
  // North ↔ South
  "delhi-mumbai": 1388,   "delhi-chennai": 2180,
  "delhi-bangalore": 2150,"delhi-bengaluru": 2150,
  "delhi-hyderabad": 1550,"delhi-kochi": 2850,
  "delhi-trivandrum": 3000,"delhi-thiruvananthapuram": 3000,
  // North ↔ East
  "delhi-kolkata": 1447,  "delhi-patna": 1000,
  "delhi-bhubaneswar": 1745,"delhi-guwahati": 1950,
  // North ↔ West
  "delhi-jaipur": 308,    "delhi-ahmedabad": 935,
  "delhi-surat": 1216,    "delhi-amritsar": 449,
  "delhi-chandigarh": 244,"delhi-lucknow": 497,
  "delhi-kanpur": 440,    "delhi-varanasi": 820,
  "delhi-allahabad": 643, "delhi-prayagraj": 643,
  "delhi-agra": 200,      "delhi-mathura": 141,
  "delhi-nagpur": 1092,   "delhi-bhopal": 705,
  "delhi-indore": 898,
  // Mumbai
  "mumbai-pune": 192,     "mumbai-goa": 587,
  "mumbai-bangalore": 1033,"mumbai-bengaluru": 1033,
  "mumbai-hyderabad": 711,"mumbai-chennai": 1279,
  "mumbai-kolkata": 1969, "mumbai-ahmedabad": 492,
  "mumbai-surat": 264,    "mumbai-nagpur": 840,
  // Chennai
  "chennai-bangalore": 362,"chennai-bengaluru": 362,
  "chennai-hyderabad": 625,"chennai-kolkata": 1659,
  "chennai-kochi": 630,   "chennai-coimbatore": 501,
  "chennai-madurai": 456, "chennai-vijayawada": 432,
  "chennai-visakhapatnam": 790,
  // Bangalore
  "bangalore-hyderabad": 574,"bengaluru-hyderabad": 574,
  "bangalore-pune": 836,  "bengaluru-pune": 836,
  "bangalore-kochi": 531, "bengaluru-kochi": 531,
  "bangalore-coimbatore": 367,"bengaluru-coimbatore": 367,
  "bangalore-madurai": 437,"bengaluru-madurai": 437,
  "bangalore-mysore": 139,"bengaluru-mysore": 139,
  // Kolkata
  "kolkata-patna": 563,   "kolkata-bhubaneswar": 440,
  "kolkata-guwahati": 1008,"kolkata-hyderabad": 1490,
  "kolkata-visakhapatnam": 1107,
  // Hyderabad
  "hyderabad-visakhapatnam": 710,"hyderabad-nagpur": 504,
  "hyderabad-pune": 562,  "hyderabad-vijayawada": 275,
  // Other
  "patna-kolkata": 563,   "patna-varanasi": 248,
  "patna-lucknow": 556,   "lucknow-kanpur": 65,
  "lucknow-varanasi": 286,"varanasi-kolkata": 680,
  "pune-goa": 455,        "ahmedabad-surat": 265,
  "ahmedabad-jaipur": 666,"jaipur-agra": 234,
  "agra-lucknow": 328,    "nagpur-bhopal": 359,
  "nagpur-pune": 642,     "raipur-nagpur": 295,
  "raipur-bhubaneswar": 430,"guwahati-kolkata": 1008,
  "guwahati-dibrugarh": 440,"visakhapatnam-bhubaneswar": 438,
};

// ── Station code → city name ──────────────────────────────────────────────────
const STATION_TO_CITY: Record<string, string> = {
  NDLS: "delhi", NZM: "delhi", DLI: "delhi", ANVT: "delhi",
  MMCT: "mumbai", BCT: "mumbai", LTT: "mumbai", CSTM: "mumbai",
  MAS: "chennai", MS: "chennai",
  SBC: "bangalore", YPR: "bangalore", BNC: "bangalore",
  SC: "hyderabad", HYB: "hyderabad",
  HWH: "kolkata", SDAH: "kolkata",
  PNBE: "patna", DNR: "patna", MFP: "muzaffarpur",
  LKO: "lucknow", LJN: "lucknow",
  BSB: "varanasi", MUV: "varanasi",
  PRYJ: "prayagraj", ALD: "prayagraj",
  ADI: "ahmedabad",
  BPL: "bhopal",
  INDB: "indore",
  NGP: "nagpur",
  PUNE: "pune",
  ST: "surat",
  JP: "jaipur",
  AGC: "agra",
  CNB: "kanpur",
  ASR: "amritsar",
  GHY: "guwahati",
  BBS: "bhubaneswar",
  VSKP: "visakhapatnam",
  BZA: "vijayawada",
  ERS: "kochi",
  TVC: "trivandrum",
  CBE: "coimbatore",
  MDU: "madurai",
  MAO: "goa",
  MYS: "mysore",
  R: "raipur", BSP: "raipur",
  UMB: "chandigarh", CDG: "chandigarh",
};

// ── Normalize station code (uppercase, trim) ──────────────────────────────────
function normalizeCode(code: string): string {
  return code.toUpperCase().trim();
}

// ── Normalize city name for city-map lookup ───────────────────────────────────
function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^new delhi$/, "delhi")
    .replace(/^bombay$/, "mumbai")
    .replace(/^madras$/, "chennai")
    .replace(/^calcutta$/, "kolkata")
    .replace(/^howrah?$/, "kolkata")
    .replace(/^sealdah$/, "kolkata")
    .replace(/^secunderabad$/, "hyderabad")
    .replace(/^bengaluru?$/, "bangalore")
    .replace(/^allahabad$/, "prayagraj")
    .replace(/^thiruvananthapuram$/, "trivandrum");
}

/**
 * Look up rail distance by STATION CODES (e.g. "NDLS", "MMCT").
 * Tries the direct code map first, then converts codes → cities and checks city map.
 * Direction-insensitive.
 */
export function lookupRailDistanceByCodes(
  fromCode: string,
  toCode: string
): number | null {
  const a = normalizeCode(fromCode);
  const b = normalizeCode(toCode);

  // Direct station code pair lookup
  const key1 = `${a}-${b}`;
  const key2 = `${b}-${a}`;
  if (STATION_CODE_MAP[key1] != null) return STATION_CODE_MAP[key1];
  if (STATION_CODE_MAP[key2] != null) return STATION_CODE_MAP[key2];

  // Fall back: code → city → city-pair map
  const cityA = STATION_TO_CITY[a];
  const cityB = STATION_TO_CITY[b];
  if (cityA && cityB) {
    return lookupRailDistance(cityA, cityB);
  }

  return null;
}

/**
 * Look up rail distance by CITY NAMES (e.g. "Delhi", "Mumbai").
 * Direction-insensitive.
 */
export function lookupRailDistance(
  origin: string,
  destination: string
): number | null {
  const a = normalizeCity(origin);
  const b = normalizeCity(destination);

  const key1 = `${a}-${b}`;
  const key2 = `${b}-${a}`;

  return CITY_ROUTE_MAP[key1] ?? CITY_ROUTE_MAP[key2] ?? null;
}

/**
 * Smart lookup: accepts either station codes OR city names.
 * Tries code lookup first, then city lookup.
 */
export function smartRailLookup(
  from: string,
  to: string
): { distanceKm: number; source: "station_code" | "city_name" } | null {
  // If inputs look like station codes (2-5 uppercase letters)
  if (/^[A-Z]{2,5}$/.test(from.trim()) && /^[A-Z]{2,5}$/.test(to.trim())) {
    const km = lookupRailDistanceByCodes(from, to);
    if (km != null) return { distanceKm: km, source: "station_code" };
    // If code lookup failed, try resolving to city
    const cityA = STATION_TO_CITY[normalizeCode(from)];
    const cityB = STATION_TO_CITY[normalizeCode(to)];
    if (cityA && cityB) {
      const km2 = lookupRailDistance(cityA, cityB);
      if (km2 != null) return { distanceKm: km2, source: "city_name" };
    }
  }

  // Try city name lookup
  const km = lookupRailDistance(from, to);
  if (km != null) return { distanceKm: km, source: "city_name" };

  return null;
}
