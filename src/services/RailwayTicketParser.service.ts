import { smartRailLookup } from "./IndiaRailwayRouteDB.js";

export type RailwayTicketItem = {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  category: string;
  amount?: number;
  currency?: string;
  metadata?: any;
};

// ── Distance extractor ───────────────────────────────────────────────────────

function extractRailwayDistanceKm(text: string): number | null {
  const normalized = text.replace(/\s+/g, " ").trim();

  const patterns = [
    /distance\s*[:\-]?\s*([\d,.]+)\s*kms?\b/i,

    // Handles: "Quota Distance Booking Date General 109 kms ..."
    /quota\s+distance\s+booking\s+date\s+.*?\b([\d,.]+)\s*kms?\b/i,

    // Handles: "Quota Distance Ticket Printing Time TATKAL 1085 KM ..."
    /quota\s+distance\s+ticket\s+printing\s+time\s+.*?\b([\d,.]+)\s*kms?\b/i,

    // General fallback inside railway ticket: first standalone number near "km"
    /\b([\d,.]{3,})\s*kms?\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return Number(match[1].replace(/,/g, ""));
    }
  }

  return null;
}

// ── Origin / Destination extractor ──────────────────────────────────────────

const MAJOR_STATIONS: Record<string, string> = {
  // Station codes → city
  NDLS: "Delhi", NZM: "Delhi", DLI: "Delhi", HWH: "Kolkata", SDAH: "Kolkata",
  MAS: "Chennai", MS: "Chennai", SBC: "Bangalore", YPR: "Bangalore",
  BNC: "Bangalore", SC: "Hyderabad", CSTM: "Mumbai", LTT: "Mumbai", BCT: "Mumbai",
  PNBE: "Patna", LKO: "Lucknow", BSB: "Varanasi", ALD: "Prayagraj",
  AGC: "Agra", BPL: "Bhopal", NGP: "Nagpur", PUNE: "Pune",
  ADI: "Ahmedabad", ST: "Surat", GHY: "Guwahati", BBS: "Bhubaneswar",
  VSKP: "Visakhapatnam", BZA: "Vijayawada", MAQ: "Mangalore",
  CBE: "Coimbatore", MDU: "Madurai", ERS: "Kochi", TVC: "Trivandrum",
  GWL: "Gwalior", JHS: "Jhansi", INDB: "Indore", UDZ: "Udaipur",
  JP: "Jaipur", AII: "Ajmer", JAT: "Jammu", UMB: "Ambala", CDG: "Chandigarh",
  DGR: "Durgapur", RNC: "Ranchi", R: "Raipur",
};

function extractOriginDestination(text: string): { origin: string; destination: string; type: "station_code" | "city" } | null {
  const normalized = text.replace(/\s+/g, " ").trim();

  // Pattern 0: Station codes like NDLS-MMCT, NDLS/MMCT, NDLS→MMCT
  const stationCodePattern = /\b([A-Z]{2,5})\s*[\-–→/]\s*([A-Z]{2,5})\b/;
  const codeMatch = text.toUpperCase().match(stationCodePattern);
  // Filter out common non-station uppercase abbreviations
  const NON_STATIONS = new Set(["IN", "PDF", "EF", "CO2", "GST", "PNR", "UBA", "KG", "INR", "KWH", "DE", "FR", "MY", "AU", "GB", "US"]);
  if (codeMatch && !NON_STATIONS.has(codeMatch[1]) && !NON_STATIONS.has(codeMatch[2])) {
    return { origin: codeMatch[1], destination: codeMatch[2], type: "station_code" };
  }

  // Pattern 1: "From: Delhi To: Mumbai" or "From Delhi To Mumbai"
  const fromToPattern = /\bfrom\s*[:\-]?\s*([A-Za-z\s]+?)\s+to\s*[:\-]?\s*([A-Za-z\s]+?)(?=\s+(?:via|on|date|pnr|train|class|berth|\d)|$)/i;
  const fromToMatch = normalized.match(fromToPattern);
  if (fromToMatch) {
    return { origin: fromToMatch[1].trim(), destination: fromToMatch[2].trim(), type: "city" };
  }

  // Pattern 2: "Board: Delhi Dest: Mumbai"
  const boardDestPattern = /\bboard(?:ing)?\s*[:\-]?\s*([A-Za-z\s]+?)\s+dest(?:ination)?\s*[:\-]?\s*([A-Za-z\s]+?)(?=\s+(?:via|on|date|pnr|train|class|berth|\d)|$)/i;
  const boardDestMatch = normalized.match(boardDestPattern);
  if (boardDestMatch) {
    return { origin: boardDestMatch[1].trim(), destination: boardDestMatch[2].trim(), type: "city" };
  }

  // Pattern 3: "origin_station": "NDLS" extracted from Mistral JSON fields
  const originFieldMatch = normalized.match(/origin[_\s]?station["\s]*[:\-]?[\s"]*([A-Za-z]{2,5})/i);
  const destFieldMatch = normalized.match(/dest(?:ination)?[_\s]?station["\s]*[:\-]?[\s"]*([A-Za-z]{2,5})/i);
  if (originFieldMatch && destFieldMatch) {
    const o = originFieldMatch[1].trim();
    const d = destFieldMatch[1].trim();
    const type = /^[A-Z]{2,5}$/.test(o) ? "station_code" : "city";
    return { origin: o, destination: d, type };
  }

  // Pattern 4: City name "Delhi to Mumbai"
  const cities = [
    "delhi", "mumbai", "chennai", "kolkata", "bangalore", "bengaluru",
    "hyderabad", "pune", "ahmedabad", "jaipur", "lucknow", "patna",
    "varanasi", "bhopal", "nagpur", "surat", "bhubaneswar", "kochi",
    "visakhapatnam", "coimbatore", "madurai", "guwahati", "trivandrum",
    "chandigarh", "amritsar", "agra", "indore", "raipur", "ranchi", "goa",
  ];
  const cityPattern = new RegExp(`\\b(${cities.join("|")})\\b.*?\\b(${cities.join("|")})\\b`, "i");
  const cityMatch = normalized.match(cityPattern);
  if (cityMatch && cityMatch[1].toLowerCase() !== cityMatch[2].toLowerCase()) {
    return { origin: cityMatch[1].trim(), destination: cityMatch[2].trim(), type: "city" };
  }

  return null;
}

// ── Passenger count ──────────────────────────────────────────────────────────

function extractPassengerCount(text: string): number {
  const normalized = text.replace(/\s+/g, " ");

  const passengerRows = normalized.match(
    /\b\d+\.\s+[A-Za-z][A-Za-z\s.]+?\s+\d+\s+(?:M|F|Male|Female)\b/g
  );

  if (passengerRows && passengerRows.length > 0) {
    return passengerRows.length;
  }

  return 1;
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseRailwayTicketItem(text: string): RailwayTicketItem | null {
  const normalized = text.replace(/\s+/g, " ");

  const isRailwayTicket =
    /indian\s*railways/i.test(normalized) ||
    /irctc/i.test(normalized) ||
    /electronic\s+reservation\s+slip/i.test(normalized) ||
    /train\s+no/i.test(normalized) ||
    /pnr/i.test(normalized);

  if (!isRailwayTicket) return null;

  // ── Step 1: Direct distance from text ───────────────────────────────────────
  let distanceKm = extractRailwayDistanceKm(text);

  if (distanceKm) {
    const passengerCount = extractPassengerCount(text);
    const passengerKm = distanceKm * passengerCount;

    return {
      name: `Indian Railways travel ${distanceKm} km`,
      description: `Indian Railways passenger travel ${distanceKm} km × ${passengerCount} passenger(s)`,
      quantity: passengerKm,
      unit: "passenger-km",
      category: "railway",
      metadata: {
        distance_km: distanceKm,
        passenger_count: passengerCount,
        distance_source: "invoice_text",
      },
    };
  }

  // ── Step 2: Origin-Destination fallback → smart lookup (code or city) ─────
  const route = extractOriginDestination(text);

  if (route) {
    const result = smartRailLookup(route.origin, route.destination);

    if (result) {
      const passengerCount = extractPassengerCount(text);
      const passengerKm = result.distanceKm * passengerCount;

      return {
        name: `Indian Railways travel ${route.origin} → ${route.destination} ${result.distanceKm} km`,
        description: `Indian Railways passenger travel ${result.distanceKm} km × ${passengerCount} passenger(s) (${result.source})`,
        quantity: passengerKm,
        unit: "passenger-km",
        category: "railway",
        metadata: {
          distance_km: result.distanceKm,
          passenger_count: passengerCount,
          origin: route.origin,
          destination: route.destination,
          distance_source: result.source,
        },
      };
    }

    // Route found but no distance in DB
    return {
      name: `Indian Railways travel ${route.origin} → ${route.destination}`,
      description: `Railway ticket detected, origin/destination found but distance not in DB`,
      quantity: 1,
      unit: "ticket",
      category: "railway_review",
      metadata: {
        reason: "RAILWAY_DISTANCE_NOT_IN_DB",
        origin: route.origin,
        destination: route.destination,
      },
    };
  }

  // ── Step 3: No distance and no route → review ─────────────────────────────
  return {
    name: "Indian Railways travel",
    description: "Railway ticket detected but distance and route not found",
    quantity: 1,
    unit: "ticket",
    category: "railway_review",
    metadata: {
      reason: "RAILWAY_DISTANCE_NOT_FOUND",
    },
  };
}
