export type RailwayTicketItem = {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  category: string;
  amount?: number;
  currency?: string;
};

function extractRailwayDistanceKm(text: string): number | null {
  const normalized = text.replace(/\s+/g, " ").trim();

  const patterns = [
    /distance\s*[:\-]?\s*([\d,.]+)\s*kms?\b/i,

    // Handles: "Quota Distance Booking Date General 109 kms ..."
    /quota\s+distance\s+booking\s+date\s+.*?\b([\d,.]+)\s*kms?\b/i,

    // Handles: "Quota Distance Ticket Printing Time TATKAL 1085 KM ..."
    /quota\s+distance\s+ticket\s+printing\s+time\s+.*?\b([\d,.]+)\s*kms?\b/i,

    // General fallback inside railway ticket
    /\b([\d,.]+)\s*kms?\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return Number(match[1].replace(/,/g, ""));
    }
  }

  return null;
}

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

export function parseRailwayTicketItem(text: string): RailwayTicketItem | null {
  const normalized = text.replace(/\s+/g, " ");

  const isRailwayTicket =
    /indian\s*railways/i.test(normalized) ||
    /irctc/i.test(normalized) ||
    /electronic\s+reservation\s+slip/i.test(normalized) ||
    /train\s+no/i.test(normalized) ||
    /pnr/i.test(normalized);

  if (!isRailwayTicket) return null;

  let distanceKm = extractRailwayDistanceKm(text);

  if (!distanceKm) {
    return {
      name: "Indian Railways travel",
      description: "Railway ticket detected but distance not found",
      quantity: 1,
      unit: "ticket",
      category: "railway_review",
    };
  }

  const passengerCount = extractPassengerCount(text);
  const passengerKm = distanceKm * passengerCount;

  return {
    name: `Indian Railways travel ${distanceKm} km`,
    description: `Indian Railways passenger travel ${distanceKm} km × ${passengerCount} passenger(s)`,
    quantity: passengerKm,
    unit: "passenger-km",
    category: "railway",
  };
}
