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

    if (expected > 0) {
      const ratio = input.extractedKwh / expected;
      const roundedRatio = Math.round(ratio);
      const isMfMatch = roundedRatio >= 1 && Math.abs((expected * roundedRatio) - input.extractedKwh) < 100;

      if (Math.abs(expected - input.extractedKwh) > 1 && !isMfMatch) {
        warnings.push(
          `Meter reading difference is ${expected.toFixed(2)} kWh, extracted ${input.extractedKwh} kWh (possible MF multiplier ${ratio.toFixed(1)}x).`
        );
      }
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