import axios from "axios";

const CLIMATIQ_API_KEY = process.env.CLIMATIQ_API_KEY;

export async function calculateEmissionWithClimatiq(params: {
  activityId: string;
  parameterName: string;
  value: number;
  unit: string;
  region?: string;
  dataVersion?: string;
  factorId?: string | null;
}) {
  const {
    activityId,
    parameterName,
    value,
    unit,
    region = "MY",
    dataVersion = "^6",
    factorId
  } = params;

  if (!CLIMATIQ_API_KEY) {
    return {
      success: false,
      error: "CLIMATIQ_API_KEY missing"
    };
  }

  const emissionFactor = factorId
    ? {
        id: factorId
      }
    : {
        activity_id: activityId,
        data_version: dataVersion,
        region,
      };

  const requestBody = {
    emission_factor: emissionFactor,
    parameters: {
      [parameterName]: value,
      [`${parameterName}_unit`]: unit
    }
  };

  try {
    const response = await axios.post(
      "https://api.climatiq.io/data/v1/estimate",
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${CLIMATIQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return {
      success: true,
      requestBody,
      data: response.data
    };
  } catch (error: any) {
    return {
      success: false,
      requestBody,
      error: error?.response?.data || error.message
    };
  }
}
