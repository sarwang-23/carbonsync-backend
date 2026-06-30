import { getEmissionMapping } from "./emissionMapping.service.js";
import { estimateWithClimatiqDirect } from "./climatiq.service.js";

type GermanyEmissionInput = {
  category: string;
  value: number;
  unit?: string;
};

export async function calculateGermanyEmission(input: GermanyEmissionInput) {
  const mapping = await getEmissionMapping("DE", input.category);

  if (!mapping) {
    return {
      success: false,
      region: "DE",
      category: input.category,
      reason: "NO_GERMANY_MAPPING_FOUND",
      message: `No Germany mapping found for category: ${input.category}`,
    };
  }

  if (!mapping.activity_id) {
    return {
      success: false,
      region: "DE",
      category: input.category,
      reason: "NO_ACTIVITY_ID",
      message: `Germany mapping exists but activity_id is missing for category: ${input.category}`,
    };
  }

  if (!mapping.parameter_name) {
    return {
      success: false,
      region: "DE",
      category: input.category,
      reason: "NO_PARAMETER_NAME",
      message: `Germany mapping exists but parameter_name is missing for category: ${input.category}`,
    };
  }

  const climatiqResult = await estimateWithClimatiqDirect({
    activityId: mapping.activity_id,
    parameterName: mapping.parameter_name,
    value: input.value,
    parameterUnit: mapping.parameter_unit || input.unit,
    dataVersion: mapping.data_version || "^6",
    region: "DE",
  });

  return {
    success: true,
    engine: "climatiq",
    source: "UBA",
    region: "DE",
    country_name: "Germany",
    category: input.category,
    input_value: input.value,
    input_unit: input.unit || mapping.parameter_unit,
    activity_id: mapping.activity_id,
    parameter_name: mapping.parameter_name,
    parameter_unit: mapping.parameter_unit,
    co2e: climatiqResult.co2e,
    co2e_unit: climatiqResult.co2e_unit,
    factor_name: climatiqResult.factor_name,
    factor_source: climatiqResult.factor_source,
    factor_region: climatiqResult.factor_region,
    raw: climatiqResult.raw,
  };
}
