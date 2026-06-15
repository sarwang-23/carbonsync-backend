export function buildClimatiqBody(mapping: any, converted: any, passengers = 1) {
  const body: any = {
    emission_factor: {
      activity_id: mapping.activity_id,
      data_version: mapping.data_version || "^6",
    },
    parameters: {},
  };

  if (mapping.region) {
    body.emission_factor.region = mapping.region;
  }

  if (mapping.parameter_name === "weight") {
    body.parameters.weight = converted.value;
    body.parameters.weight_unit = "kg";
  }

  if (mapping.parameter_name === "energy") {
    body.parameters.energy = converted.value;
    body.parameters.energy_unit = "kWh";
  }

  if (mapping.parameter_name === "distance") {
    body.parameters.distance = converted.value;
    body.parameters.distance_unit = "km";
    body.parameters.passengers = passengers;
  }

  return body;
}