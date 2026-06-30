import { pool } from "../db.js";

export type FlightTicketItem = {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  category: string;
  metadata?: {
    fromAirport?: string;
    toAirport?: string;
    passengerCount?: number;
    distanceKm?: number;
  };
};

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function isFlightTicketText(text: string) {
  const lower = text.toLowerCase();

  return (
    lower.includes("flight ticket") ||
    lower.includes("flight booking") ||
    lower.includes("boarding pass") ||
    lower.includes("airport") ||
    lower.includes("indigo") ||
    lower.includes("spice jet") ||
    lower.includes("spicejet") ||
    lower.includes("air india") ||
    lower.includes("vistara") ||
    lower.includes("akasa") ||
    lower.includes("go first") ||
    lower.includes("pnr")
  );
}

function extractAirportPair(text: string, fileName = "") {
  const combined = normalize(`${fileName} ${text}`).toUpperCase();

  // PAT - BOM / PNQ - DEL
  const directRoute = combined.match(/\b([A-Z]{3})\s*[-–]\s*([A-Z]{3})\b/);
  if (directRoute) {
    return {
      fromAirport: directRoute[1],
      toAirport: directRoute[2],
    };
  }

  // PNQ 06:00 ... 08:10 DEL
  const timeRoute = combined.match(
    /\b([A-Z]{3})\s+\d{1,2}:\d{2}\s*(?:HRS)?\b.*?\b\d{1,2}:\d{2}\s*(?:HRS)?\s+([A-Z]{3})\b/
  );
  if (timeRoute) {
    return {
      fromAirport: timeRoute[1],
      toAirport: timeRoute[2],
    };
  }

  // City fallback
  const cityPairs: Array<{
    fromCity: string;
    toCity: string;
    fromAirport: string;
    toAirport: string;
  }> = [
    { fromCity: "PATNA", toCity: "MUMBAI", fromAirport: "PAT", toAirport: "BOM" },
    { fromCity: "PUNE", toCity: "DELHI", fromAirport: "PNQ", toAirport: "DEL" },
    { fromCity: "DELHI", toCity: "PUNE", fromAirport: "DEL", toAirport: "PNQ" },
    { fromCity: "DELHI", toCity: "MUMBAI", fromAirport: "DEL", toAirport: "BOM" },
    { fromCity: "MUMBAI", toCity: "DELHI", fromAirport: "BOM", toAirport: "DEL" },
    { fromCity: "DELHI", toCity: "BENGALURU", fromAirport: "DEL", toAirport: "BLR" },
    { fromCity: "BENGALURU", toCity: "DELHI", fromAirport: "BLR", toAirport: "DEL" },
    { fromCity: "DELHI", toCity: "HYDERABAD", fromAirport: "DEL", toAirport: "HYD" },
    { fromCity: "HYDERABAD", toCity: "DELHI", fromAirport: "HYD", toAirport: "DEL" },
    { fromCity: "DELHI", toCity: "CHENNAI", fromAirport: "DEL", toAirport: "MAA" },
    { fromCity: "CHENNAI", toCity: "DELHI", fromAirport: "MAA", toAirport: "DEL" },
    { fromCity: "KOLKATA", toCity: "DELHI", fromAirport: "CCU", toAirport: "DEL" },
    { fromCity: "DELHI", toCity: "KOLKATA", fromAirport: "DEL", toAirport: "CCU" },
  ];

  for (const pair of cityPairs) {
    if (combined.includes(pair.fromCity) && combined.includes(pair.toCity)) {
      return {
        fromAirport: pair.fromAirport,
        toAirport: pair.toAirport,
      };
    }
  }

  return null;
}

function extractPassengerCount(text: string) {
  const normalized = normalize(text);

  const travellerRows = normalized.match(
    /\b(?:MR\.|MRS\.|MS\.|MISS|MASTER)\s+[A-Z][A-Z\s]+\s+Adult\b/gi
  );
  if (travellerRows?.length) return travellerRows.length;

  // fallback — single passenger
  return 1;
}

async function getFlightDistance(
  fromAirport: string,
  toAirport: string
): Promise<number | null> {
  try {
    const result = await pool.query(
      `
      select distance_km
      from flight_route_distances
      where from_airport_code = $1
        and to_airport_code = $2
        and is_active = true
      limit 1
      `,
      [fromAirport, toAirport]
    );

    if (!result.rows[0]) return null;
    return Number(result.rows[0].distance_km);
  } catch {
    return null;
  }
}

export async function parseFlightTicketItem(
  text: string,
  fileName = ""
): Promise<FlightTicketItem | null> {
  const combined = normalize(`${fileName} ${text}`);

  if (!isFlightTicketText(combined)) {
    return null;
  }

  const airportPair = extractAirportPair(text, fileName);

  if (!airportPair) {
    return {
      name: "Flight travel",
      description: "Flight ticket detected but airport pair could not be extracted",
      quantity: 1,
      unit: "ticket",
      category: "flight_review",
    };
  }

  const distanceKm = await getFlightDistance(
    airportPair.fromAirport,
    airportPair.toAirport
  );

  if (!distanceKm) {
    return {
      name: `Flight travel ${airportPair.fromAirport}-${airportPair.toAirport}`,
      description: `Flight ticket detected but distance mapping not found for ${airportPair.fromAirport}-${airportPair.toAirport}`,
      quantity: 1,
      unit: "ticket",
      category: "flight_review",
      metadata: {
        fromAirport: airportPair.fromAirport,
        toAirport: airportPair.toAirport,
      },
    };
  }

  const passengerCount = extractPassengerCount(text);
  const passengerKm = distanceKm * passengerCount;

  return {
    name: `Flight travel ${airportPair.fromAirport}-${airportPair.toAirport} ${distanceKm} km`,
    description: `Flight passenger travel ${airportPair.fromAirport}-${airportPair.toAirport}: ${distanceKm} km × ${passengerCount} passenger(s)`,
    quantity: passengerKm,
    unit: "km",
    category: "flight",
    metadata: {
      fromAirport: airportPair.fromAirport,
      toAirport: airportPair.toAirport,
      passengerCount,
      distanceKm,
    },
  };
}
