export function calculateIndiaElectricityEmission(input: any) {
  const quantityKwh = typeof input === "number" ? input : input.quantity || 0;
  const factor = 0.710;
  const co2e = quantityKwh * factor;

  return {
    success: true,
    country: "IN",
    category: "electricity_bill",
    item_name: input?.itemName || "India Electricity Bill",
    validation: input?.validation || null,
    result: {
      co2e,
      co2e_unit: "kg",
      total_tco2e: co2e / 1000,
      emission_factor: factor,
      factor_region: "IN",
      source: "India Region Fixed EF",
      factor_name: "India Electricity Fixed EF",
    },
  };
}

export function calculateIndiaTrainEmission(input: any, passCount?: number) {
  const distanceKm = typeof input === "number" ? input : input.distanceKm || 0;
  const passengerCount = typeof input === "number" ? (passCount || 1) : (input.passengerCount || 1);
  const factor = 0.007976;
  const passengerKm = distanceKm * passengerCount;
  const co2e = passengerKm * factor;

  return {
    success: true,
    country: "IN",
    category: "train_ticket",
    item_name: input?.itemName || "India Train Ticket",
    validation: input?.validation || null,
    result: {
      co2e,
      co2e_unit: "kg",
      total_tco2e: co2e / 1000,
      emission_factor: factor,
      factor_region: "IN",
      source: "India Region Fixed EF",
      factor_name: "India Train Fixed EF",
      passenger_km: passengerKm,
    },
  };
}

export function calculateIndiaFlightEmission(input: any, passCount?: number) {
  const distanceKm = typeof input === "number" ? input : input.distanceKm || 0;
  const passengerCount = typeof input === "number" ? (passCount || 1) : (input.passengerCount || 1);
  const factor = 0.18;
  const passengerKm = distanceKm * passengerCount;
  const co2e = passengerKm * factor;

  return {
    success: true,
    country: "IN",
    category: "flight_ticket",
    item_name: input?.itemName || "India Flight Ticket",
    validation: input?.validation || null,
    result: {
      co2e,
      co2e_unit: "kg",
      total_tco2e: co2e / 1000,
      emission_factor: factor,
      factor_region: "IN",
      source: "India Region Fixed EF",
      factor_name: "India Flight Fixed EF",
      passenger_km: passengerKm,
    },
  };
}