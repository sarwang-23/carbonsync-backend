export function validateElectricityBill(input: {
  extractedKwh: number;
  previousReading?: number;
  currentReading?: number;
  rawText?: string;
  source?: string;
}) {
  const warnings: string[] = [];

  if (!input.extractedKwh || input.extractedKwh <= 0) {
    return {
      valid: false,
      confidence: 0.2,
      warnings: ["Electricity usage kWh is missing or invalid."],
    };
  }

  if (input.previousReading && input.currentReading) {
    const expected = input.currentReading - input.previousReading;

    if (Math.abs(expected - input.extractedKwh) > 1) {
      warnings.push(
        `Meter reading mismatch. Expected ${expected} kWh but extracted ${input.extractedKwh} kWh.`
      );

      return {
        valid: false,
        confidence: 0.4,
        expected_quantity: expected,
        extracted_quantity: input.extractedKwh,
        warnings,
      };
    }
  }

  return {
    valid: true,
    confidence: warnings.length ? 0.75 : 0.95,
    warnings,
  };
}

export function validateTrainTicket(input: { distanceKm?: number; passengerCount?: number; country?: string }) {
    const warnings: string[] = [];
    if (!input.distanceKm || input.distanceKm <= 0) {
        warnings.push("Train ticket distance is missing or invalid.");
    }
    if (!input.passengerCount || input.passengerCount <= 0) {
        warnings.push("Train ticket passenger count is invalid.");
    }
    
    return {
        valid: warnings.length === 0,
        confidence: warnings.length === 0 ? 0.95 : 0.4,
        warnings,
    };
}

export function validateFlightTicket(input: { distanceKm?: number; passengerCount?: number; origin?: string; destination?: string; country?: string }) {
    const warnings: string[] = [];
    if (!input.distanceKm || input.distanceKm <= 0) {
        warnings.push("Flight ticket distance is missing or invalid.");
    }
    if (!input.passengerCount || input.passengerCount <= 0) {
        warnings.push("Flight ticket passenger count is invalid.");
    }
    
    return {
        valid: warnings.length === 0,
        confidence: warnings.length === 0 ? 0.95 : 0.4,
        warnings,
    };
}