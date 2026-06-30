const CLIMATIQ_BASE_URL =
  process.env.CLIMATIQ_BASE_URL || "https://api.climatiq.io/data/v1";

type ClimatiqSearchInput = {
  query: string;
  region?: string;
  dataVersion?: string;
  resultsPerPage?: number;
};

export async function searchClimatiqFactor(input: ClimatiqSearchInput) {
  const apiKey = process.env.CLIMATIQ_API_KEY;

  if (!apiKey) {
    throw new Error("CLIMATIQ_API_KEY is missing in .env");
  }

  const params = new URLSearchParams();

  params.set("query", input.query);
  params.set("data_version", input.dataVersion || "^6");
  params.set("results_per_page", String(input.resultsPerPage || 10));

  if (input.region) {
    params.set("region", input.region);
  }

  const url = `${CLIMATIQ_BASE_URL}/search?${params.toString()}`;

  console.log("CLIMATIQ SEARCH URL:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json() as any;

  if (!response.ok) {
    console.error("CLIMATIQ SEARCH ERROR:", data);
    throw new Error(
      data?.message ||
        data?.error ||
        `Climatiq search failed with status ${response.status}`
    );
  }

  const results = data.results || data.data || [];

  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  return results[0];
}
