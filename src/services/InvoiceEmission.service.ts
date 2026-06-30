import { calculateGermanyEmission } from "./GermanyEmission.service.js";
import { pool } from "../db.js";

type InvoiceEmissionItem = {
  item_name: string;
  category: string;
  value: number;
  unit: string;
};

type ProcessInvoiceEmissionInput = {
  region: string;
  country_name: string;
  invoice_year?: number | null;
  items: InvoiceEmissionItem[];
};

function normalizeUnit(unit: string) {
  return unit
    .toLowerCase()
    .replace("kwj", "kwh")
    .replace("kilowatt hour", "kwh")
    .replace("kilowatt-hour", "kwh")
    .replace("m³", "m3")
    .replace("cubic metre", "m3")
    .replace("cubic meter", "m3")
    .replace("litre", "l")
    .replace("liter", "l")
    .trim();
}

function unitMatches(invoiceUnit: string, factorUnit: string) {
  const u = normalizeUnit(invoiceUnit);
  const f = normalizeUnit(factorUnit);

  if (f === "kg/kwh" && u === "kwh") return true;
  if (f === "kg/m3" && u === "m3") return true;
  if (
    f === "kg/tonne" &&
    (u === "tonne" || u === "tonnes" || u === "t")
  )
    return true;
  if (
    f === "kg/kl" &&
    (u === "kl" || u === "kilolitre" || u === "kiloliter")
  )
    return true;

  return false;
}

async function findLocalOfficialFactor(params: {
  region: string;
  category: string;
  unit: string;
  itemName: string;
}) {
  const result = await pool.query(
    `
    select
      factor_id,
      activity_id,
      name,
      category,
      region,
      source,
      source_dataset,
      source_lca_activity,
      year,
      unit,
      factor,
      scopes,
      constituent_gases,
      additional_indicators
    from official_emission_factors
    where region = $1
      and is_active = true
      and factor is not null
      and (
        lower(category) = lower($2)
        or lower(name) like '%' || lower($2) || '%'
        or lower($2) = any(select lower(unnest(keywords)))
      )
    order by
      case
        when lower(category) = lower($2) then 1
        when lower(name) like '%' || lower($2) || '%' then 2
        else 3
      end,
      year desc nulls last
    limit 20
    `,
    [params.region, params.category]
  );

  const rows = result.rows || [];

  const exactUnit = rows.find((row) =>
    row.unit ? unitMatches(params.unit, row.unit) : false
  );

  return exactUnit || rows[0] || null;
}

function calculateLocalCo2e(
  value: number,
  unit: string,
  factorUnit: string,
  factor: number
) {
  const normalizedUnit = normalizeUnit(unit);
  const normalizedFactorUnit = normalizeUnit(factorUnit);

  if (normalizedFactorUnit === "kg/kwh" && normalizedUnit === "kwh") {
    return value * factor;
  }
  if (normalizedFactorUnit === "kg/m3" && normalizedUnit === "m3") {
    return value * factor;
  }
  if (
    normalizedFactorUnit === "kg/tonne" &&
    (normalizedUnit === "tonne" || normalizedUnit === "tonnes" || normalizedUnit === "t")
  ) {
    return value * factor;
  }
  if (
    normalizedFactorUnit === "kg/kl" &&
    (normalizedUnit === "kl" || normalizedUnit === "kilolitre" || normalizedUnit === "kiloliter")
  ) {
    return value * factor;
  }

  return null;
}

export async function processInvoiceEmissions(
  input: ProcessInvoiceEmissionInput
) {
  const results: any[] = [];
  let totalCo2e = 0;
  let calculatedCount = 0;
  let reviewCount = 0;
  let failedCount = 0;

  for (const item of input.items) {
    try {
      if (!item.value || !Number.isFinite(Number(item.value))) {
        reviewCount++;
        results.push({
          item_name: item.item_name,
          category: item.category,
          value: item.value,
          unit: item.unit,
          status: "review",
          reason: "INVALID_VALUE",
          message: "This item needs manual review or mapping update",
        });
        continue;
      }

      if (!item.category || item.category === "unknown") {
        reviewCount++;
        results.push({
          item_name: item.item_name,
          category: item.category,
          value: item.value,
          unit: item.unit,
          status: "review",
          reason: "UNKNOWN_CATEGORY",
          message: "This item needs manual review or mapping update",
        });
        continue;
      }

      // ── Germany ─── Climatiq UBA route ─────────────────────────────────────
      if (input.region === "DE") {
        try {
          const germanyResult = await calculateGermanyEmission({
            category: item.category,
            value: Number(item.value),
            unit: item.unit,
          });

          if (!germanyResult.success) {
            reviewCount++;
            results.push({
              item_name: item.item_name,
              category: item.category,
              value: item.value,
              unit: item.unit,
              status: "review",
              source_engine: "climatiq",
              region: "DE",
              reason: (germanyResult as any).reason || "NO_GERMANY_MAPPING_FOUND",
              message: (germanyResult as any).message || "This item needs manual review or mapping update",
            });
            continue;
          }

          calculatedCount++;
          totalCo2e += germanyResult.co2e;
          results.push({
            item_name: item.item_name,
            category: item.category,
            value: item.value,
            unit: item.unit,
            status: "calculated",
            source_engine: "climatiq",
            preferred_source: "UBA",
            region: "DE",
            country_name: "Germany",
            activity_id: germanyResult.activity_id,
            parameter_name: germanyResult.parameter_name,
            parameter_unit: germanyResult.parameter_unit,
            co2e: germanyResult.co2e,
            co2e_unit: germanyResult.co2e_unit,
            factor_name: germanyResult.factor_name,
            factor_source: germanyResult.factor_source,
            factor_region: germanyResult.factor_region,
            converted: germanyResult.converted,
          });
        } catch (err: any) {
          reviewCount++;
          results.push({
            item_name: item.item_name,
            category: item.category,
            value: item.value,
            unit: item.unit,
            status: "review",
            source_engine: "climatiq",
            region: "DE",
            reason: "CLIMATIQ_ERROR",
            message: err.message || "Climatiq API call failed",
          });
        }
        continue;
      }

      // ── US / GB / FR / AU ─── local official_emission_factors DB route ─────
      const factor = await findLocalOfficialFactor({
        region: input.region,
        category: item.category,
        unit: item.unit,
        itemName: item.item_name,
      });

      if (!factor) {
        reviewCount++;
        results.push({
          item_name: item.item_name,
          category: item.category,
          value: item.value,
          unit: item.unit,
          status: "review",
          source_engine: "official_factor_db",
          region: input.region,
          reason: "NO_LOCAL_FACTOR_FOUND",
          message: "This item needs manual review or mapping update",
        });
        continue;
      }

      const co2e = calculateLocalCo2e(
        Number(item.value),
        item.unit,
        factor.unit,
        Number(factor.factor)
      );

      if (co2e === null) {
        reviewCount++;
        results.push({
          item_name: item.item_name,
          category: item.category,
          value: item.value,
          unit: item.unit,
          status: "review",
          source_engine: "official_factor_db",
          region: input.region,
          reason: "UNIT_MISMATCH",
          factor_unit: factor.unit,
          factor_name: factor.name,
          message: "This item needs manual review or mapping update",
        });
        continue;
      }

      calculatedCount++;
      totalCo2e += co2e;
      results.push({
        item_name: item.item_name,
        category: item.category,
        value: item.value,
        unit: item.unit,
        status: "calculated",
        source_engine: "official_factor_db",
        region: input.region,
        country_name: input.country_name,
        factor_id: factor.factor_id,
        activity_id: factor.activity_id,
        factor_name: factor.name,
        factor_category: factor.category,
        factor_unit: factor.unit,
        factor_value: Number(factor.factor),
        source: factor.source,
        source_dataset: factor.source_dataset,
        source_lca_activity: factor.source_lca_activity,
        scopes: factor.scopes,
        co2e,
        co2e_unit: "kg",
      });
    } catch (error: any) {
      failedCount++;
      results.push({
        item_name: item.item_name,
        category: item.category,
        value: item.value,
        unit: item.unit,
        status: "failed",
        reason: "CALCULATION_ERROR",
        message: error.message,
      });
    }
  }

  return {
    success: failedCount === 0,
    region: input.region,
    country_name: input.country_name,
    total_items: input.items.length,
    calculated_count: calculatedCount,
    review_count: reviewCount,
    failed_count: failedCount,
    total_co2e: Number(totalCo2e.toFixed(6)),
    total_co2e_unit: "kg",
    results,
  };
}
