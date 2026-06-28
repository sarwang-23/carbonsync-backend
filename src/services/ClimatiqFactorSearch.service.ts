import axios from "axios";
import { supabase } from "../lib/supabase.js";

const CLIMATIQ_API_KEY = process.env.CLIMATIQ_API_KEY;

function pickBestFactor(factors: any[], billYear?: number | null) {
  if (!Array.isArray(factors) || factors.length === 0) return null;

  const valid = factors.filter((f) => f?.id && f?.year);

  if (valid.length === 0) return factors[0];

  const tieBreakerSort = (a: any, b: any) => {
    const aIsIndirect = (a.source_lca_activity === "well_to_tank" || String(a.name || "").toLowerCase().includes("transmission")) ? 1 : 0;
    const bIsIndirect = (b.source_lca_activity === "well_to_tank" || String(b.name || "").toLowerCase().includes("transmission")) ? 1 : 0;
    
    if (aIsIndirect !== bIsIndirect) return aIsIndirect - bIsIndirect;
    
    return Number(b.year_released || 0) - Number(a.year_released || 0);
  };

  if (billYear) {
    const exact = valid
      .filter((f) => Number(f.year) === billYear)
      .sort(tieBreakerSort)[0];

    if (exact) return exact;

    const previousOrSame = valid
      .filter((f) => Number(f.year) <= billYear)
      .sort((a, b) => {
        if (Number(b.year) !== Number(a.year)) return Number(b.year) - Number(a.year);
        return tieBreakerSort(a, b);
      })[0];

    if (previousOrSame) return previousOrSame;
  }

  return valid.sort((a, b) => {
    if (Number(b.year) !== Number(a.year)) return Number(b.year) - Number(a.year);
    return tieBreakerSort(a, b);
  })[0];
}

export async function findBestClimatiqFactorForBill(params: {
  region: string;
  category: string;
  activityId: string;
  parameterName: string;
  parameterUnit: string;
  billYear?: number | null;
}) {
  const {
    region,
    category,
    activityId,
    parameterName,
    parameterUnit,
    billYear,
  } = params;

  if (!CLIMATIQ_API_KEY) {
    throw new Error("CLIMATIQ_API_KEY missing");
  }

  const { data: cached } = await supabase
    .from("climatiq_factor_cache")
    .select("*")
    .eq("region", region)
    .eq("category", category)
    .eq("activity_id", activityId)
    .eq("bill_year", billYear || 0)
    .maybeSingle();

  if (cached?.selected_factor_id) {
    return {
      factorId: cached.selected_factor_id,
      factorYear: cached.selected_factor_year,
      source: cached.source,
      sourceDataset: cached.source_dataset,
      sourceLcaActivity: cached.source_lca_activity,
      rawFactor: cached.raw_factor,
      fromCache: true,
    };
  }

  const response = await axios.get("https://api.climatiq.io/data/v1/search", {
    headers: {
      Authorization: `Bearer ${CLIMATIQ_API_KEY}`,
    },
    params: {
      query: "electricity supplied from grid",
      region,
      category: "Electricity",
      activity_id: activityId,
      data_version: "^6",
      results_per_page: 50,
    },
  });

  const factors = response.data?.results || response.data?.data || [];
  const best = pickBestFactor(factors, billYear);

  if (!best) {
    throw new Error("No Climatiq factor found for bill");
  }

  await supabase.from("climatiq_factor_cache").upsert({
    region,
    category,
    activity_id: activityId,
    parameter_name: parameterName,
    parameter_unit: parameterUnit,
    bill_year: billYear || 0,
    selected_factor_id: best.id,
    selected_factor_year: best.year || null,
    source: best.source || null,
    source_dataset: best.source_dataset || null,
    source_lca_activity: best.source_lca_activity || null,
    raw_factor: best,
    updated_at: new Date().toISOString(),
  });

  return {
    factorId: best.id,
    factorYear: best.year || null,
    source: best.source || null,
    sourceDataset: best.source_dataset || null,
    sourceLcaActivity: best.source_lca_activity || null,
    rawFactor: best,
    fromCache: false,
  };
}
