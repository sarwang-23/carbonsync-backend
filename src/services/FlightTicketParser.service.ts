import { pool } from "../db.js";

export type FlightTicketItem = {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  category: string;
  metadata?: any;
};

type AirportPair = {
  fromAirport: string;
  toAirport: string;
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
    lower.includes("cleartrip") ||
    lower.includes("makemytrip") ||
    lower.includes("pnr")
  );
}

function extractAllAirportPairs(text: string, fileName = ""): AirportPair[] {
  const combined = normalize(`${fileName} ${text}`).toUpperCase();
  const pairs: AirportPair[] = [];

  // Format: PAT - BOM, PNQ - DEL, RPR-GOI
  const directRouteRegex = /\b([A-Z]{3})\s*[-–]\s*([A-Z]{3})\b/g;
  let directMatch;

  while ((directMatch = directRouteRegex.exec(combined)) !== null) {
    const fromAirport = directMatch[1];
    const toAirport = directMatch[2];

    if (fromAirport !== toAirport) {
      pairs.push({ fromAirport, toAirport });
    }
  }

  // Format: RPR 18:55 ... 20:45 GOI
  const timedRouteRegex =
    /\b([A-Z]{3})\s+\d{1,2}:\d{2}\s*(?:HRS)?\b.*?\b\d{1,2}:\d{2}\s*(?:HRS)?\s+([A-Z]{3})\b/g;

  let timedMatch;

  while ((timedMatch = timedRouteRegex.exec(combined)) !== null) {
    const fromAirport = timedMatch[1];
    const toAirport = timedMatch[2];

    if (fromAirport !== toAirport) {
      pairs.push({ fromAirport, toAirport });
    }
  }

  // City fallback for common text patterns
  const cityPairs = [
    { fromCity: "PATNA", toCity: "MUMBAI", fromAirport: "PAT", toAirport: "BOM" },
    { fromCity: "PUNE", toCity: "DELHI", fromAirport: "PNQ", toAirport: "DEL" },
    { fromCity: "DELHI", toCity: "PUNE", fromAirport: "DEL", toAirport: "PNQ" },
    { fromCity: "RAIPUR", toCity: "GOA", fromAirport: "RPR", toAirport: "GOI" },
    { fromCity: "GOA", toCity: "RAIPUR", fromAirport: "GOI", toAirport: "RPR" },
    { fromCity: "DELHI", toCity: "MUMBAI", fromAirport: "DEL", toAirport: "BOM" },
    { fromCity: "MUMBAI", toCity: "DELHI", fromAirport: "BOM", toAirport: "DEL" },
    { fromCity: "BENGALURU", toCity: "DELHI", fromAirport: "BLR", toAirport: "DEL" },
    { fromCity: "DELHI", toCity: "BENGALURU", fromAirport: "DEL", toAirport: "BLR" },
    { fromCity: "HYDERABAD", toCity: "DELHI", fromAirport: "HYD", toAirport: "DEL" },
    { fromCity: "DELHI", toCity: "HYDERABAD", fromAirport: "DEL", toAirport: "HYD" },
    { fromCity: "CHENNAI", toCity: "DELHI", fromAirport: "MAA", toAirport: "DEL" },
    { fromCity: "DELHI", toCity: "CHENNAI", fromAirport: "DEL", toAirport: "MAA" },
  ];

  for (const pair of cityPairs) {
    if (
      combined.includes(`${pair.fromCity} TO ${pair.toCity}`) ||
      combined.includes(`${pair.fromCity} - ${pair.toCity}`) ||
      (combined.includes(pair.fromCity) && combined.includes(pair.toCity))
    ) {
      pairs.push({
        fromAirport: pair.fromAirport,
        toAirport: pair.toAirport,
      });
    }
  }

  // Remove duplicate pairs
  const seen = new Set<string>();

  return pairs.filter((pair) => {
    const key = `${pair.fromAirport}-${pair.toAirport}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractPassengerCount(text: string) {
  const normalized = normalize(text);

  const travellerRows = normalized.match(
    /\b(?:MR\.|MRS\.|MS\.|MISS|MASTER)\s+[A-Z][A-Z\s.]+?\s+Adult\b/gi
  );

  if (travellerRows?.length) return travellerRows.length;

  return 1;
}

async function getAirportCoordinates(airportCode: string) {
  const result = await pool.query(
    `
    select airport_code, latitude, longitude, city
    from airport_coordinates
    where airport_code = $1
      and is_active = true
    limit 1
    `,
    [airportCode]
  );

  if (!result.rows[0]) return null;

  return {
    airportCode: result.rows[0].airport_code as string,
    latitude: Number(result.rows[0].latitude),
    longitude: Number(result.rows[0].longitude),
    city: result.rows[0].city as string,
  };
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusKm = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusKm * c);
}

export async function calculateRouteDistance(pair: AirportPair) {
  const from = await getAirportCoordinates(pair.fromAirport);
  const to = await getAirportCoordinates(pair.toAirport);

  if (!from || !to) {
    return {
      success: false as const,
      reason: "AIRPORT_COORDINATES_NOT_FOUND",
      missing_airports: {
        from: from ? null : pair.fromAirport,
        to: to ? null : pair.toAirport,
      },
      distanceKm: 0,
      from: null as any,
      to: null as any,
    };
  }

  const distanceKm = haversineDistanceKm(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude
  );

  return {
    success: true as const,
    distanceKm,
    from,
    to,
    reason: null,
    missing_airports: null,
  };
}

export async function parseFlightTicketItem(
  text: string,
  fileName = ""
): Promise<FlightTicketItem | null> {
  const combined = normalize(`${fileName} ${text}`);

  if (!isFlightTicketText(combined)) {
    return null;
  }

  const airportPairs = extractAllAirportPairs(text, fileName);

  if (!airportPairs.length) {
    return {
      name: "Flight travel",
      description: "Flight ticket detected but airport pair could not be extracted",
      quantity: 1,
      unit: "ticket",
      category: "flight_review",
      metadata: {
        reason: "AIRPORT_PAIR_NOT_EXTRACTED",
      },
    };
  }

  let totalDistanceKm = 0;
  const routeDetails: any[] = [];

  for (const pair of airportPairs) {
    const result = await calculateRouteDistance(pair);

    if (!result.success) {
      return {
        name: `Flight travel ${pair.fromAirport}-${pair.toAirport}`,
        description: `Flight ticket detected but airport coordinates missing for ${pair.fromAirport}-${pair.toAirport}`,
        quantity: 1,
        unit: "ticket",
        category: "flight_review",
        metadata: {
          reason: result.reason,
          missing_airports: result.missing_airports,
        },
      };
    }

    totalDistanceKm += result.distanceKm;

    routeDetails.push({
      fromAirport: pair.fromAirport,
      toAirport: pair.toAirport,
      distanceKm: result.distanceKm,
      fromCity: result.from.city,
      toCity: result.to.city,
    });
  }

  const passengerCount = extractPassengerCount(text);
  const totalPassengerKm = totalDistanceKm * passengerCount;

  return {
    name: `Flight travel ${airportPairs
      .map((p) => `${p.fromAirport}-${p.toAirport}`)
      .join(" + ")} ${totalDistanceKm} km`,
    description: `Flight passenger travel ${totalDistanceKm} km × ${passengerCount} passenger(s)`,
    quantity: totalPassengerKm,
    unit: "km",
    category: "flight",
    metadata: {
      routes: routeDetails,
      passengerCount,
      totalDistanceKm,
      calculation_method: "haversine_airport_coordinates",
    },
  };
}
