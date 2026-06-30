import { calculateGermanyEmission } from "./GermanyEmission.service.js";
import { calculateIndiaEmission } from "./IndiaEmission.service.js";
import { calculateWithClimatiqFallback } from "./ClimatiqFallback.service.js";
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
  console.log("EMISSION INPUT REGION:", input.region);
  console.log("EMISSION INPUT COUNTRY:", input.country_name);
  console.log("EMISSION ITEMS:", input.items);

  const results: any[] = [];
  let totalCo2e = 0;
  let calculatedCount = 0;
  let reviewCount = 0;
  let failedCount = 0;

  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i] as any;
    try {
      const itemName =
        item.item_name ||
        item.name ||
        item.description ||
        "Unknown item";

      const category = item.category || "unknown";
      const value = Number(item.value || item.quantity);
      const unit = item.unit;

      console.log("ITEM ROUTING CHECK:", {
        region: input.region,
        category,
        value,
        unit,
      });

      if (category === "railway_review") {
        reviewCount++;
        results.push({
          line_index: i,
          item_name: itemName,
          category: "railway",
          value,
          unit,
          status: "review",
          reason: "RAILWAY_DISTANCE_NOT_FOUND",
          message: "Railway ticket detected but distance could not be extracted",
        });
        continue;
      }

      if (!value || !Number.isFinite(value)) {
        reviewCount++;
        results.push({
          line_index: i,
          item_name: itemName,
          category,
          value,
          unit,
          status: "review",
          reason: "INVALID_VALUE",
          message: "This item needs manual review or mapping update",
        });
        continue;
      }

      if (category === "unknown") {
        reviewCount++;
        results.push({
          line_index: i,
          item_name: itemName,
          category,
          value,
          unit,
          status: "review",
          reason: "UNKNOWN_CATEGORY",
          message: "This item needs manual review or mapping update",
        });
        continue;
      }

      if (category === "flight_review") {
        reviewCount++;
        results.push({
          line_index: i,
          item_name: itemName,
          category: "flight",
          value,
          unit,
          status: "review",
          reason: "FLIGHT_DISTANCE_NOT_FOUND",
          message: "Flight ticket detected but airport pair/distance mapping could not be extracted",
          metadata: (item as any).metadata || null,
        });
        continue;
      }

      // ── India ─── Hybrid Fixed EF + Climatiq Fallback route ──────────────────
      if (input.region === "IN") {
        console.log("USING INDIA FIXED/HYBRID ROUTE");

        const indiaResult = await calculateIndiaEmission({
          category,
          itemName,
          value,
          unit,
        });

        if (!indiaResult.success) {
          reviewCount++;

          results.push({
            line_index: i,
            item_name: itemName,
            category,
            value,
            unit,
            status: "review",
            source_engine: (indiaResult as any).source_engine || "india_hybrid",
            region: "IN",
            reason: (indiaResult as any).reason,
            message: (indiaResult as any).message,
            expected_factor_unit: (indiaResult as any).expected_factor_unit,
          });

          continue;
        }

        calculatedCount++;
        totalCo2e += (indiaResult as any).co2e;

        results.push({
          line_index: i,
          item_name: itemName,
          category,
          value,
          unit,
          status: "calculated",
          source_engine: (indiaResult as any).source_engine || (indiaResult as any).engine,
          preferred_source: (indiaResult as any).preferred_source || (indiaResult as any).source,
          region: "IN",
          country_name: "India",
          factor_name: (indiaResult as any).factor_name,
          factor_value: (indiaResult as any).factor_value,
          factor_unit: (indiaResult as any).factor_unit,
          source_dataset: (indiaResult as any).source_dataset,
          year: (indiaResult as any).year,
          activity_id: (indiaResult as any).activity_id,
          parameter_name: (indiaResult as any).parameter_name,
          parameter_unit: (indiaResult as any).parameter_unit,
          converted: (indiaResult as any).converted,
          co2e: (indiaResult as any).co2e,
          co2e_unit: (indiaResult as any).co2e_unit,
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
        const fallbackResult = await calculateWithClimatiqFallback({
          region: input.region,
          countryName: input.country_name,
          category: item.category,
          itemName: item.item_name,
          value: Number(item.value),
          unit: item.unit,
        });

        if (!fallbackResult.success) {
          reviewCount++;

          results.push({
            item_name: item.item_name,
            category: item.category,
            value: item.value,
            unit: item.unit,
            status: "review",
            source_engine: "official_factor_db_then_climatiq",
            region: input.region,
            reason: fallbackResult.reason || "NO_LOCAL_FACTOR_AND_CLIMATIQ_FAILED",
            message: fallbackResult.message,
          });

          continue;
        }

        calculatedCount++;
        totalCo2e += fallbackResult.co2e;

        results.push({
          item_name: item.item_name,
          category: item.category,
          value: item.value,
          unit: item.unit,
          status: "calculated",
          source_engine: "climatiq",
          fallback_used: true,
          preferred_source: "Climatiq",
          region: input.region,
          country_name: input.country_name,
          activity_id: fallbackResult.activity_id,
          parameter_name: fallbackResult.parameter_name,
          parameter_unit: fallbackResult.parameter_unit,
          converted: fallbackResult.converted,
          co2e: fallbackResult.co2e,
          co2e_unit: fallbackResult.co2e_unit,
          factor_name: fallbackResult.factor_name,
          factor_source: fallbackResult.factor_source,
          factor_region: fallbackResult.factor_region,
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
        const fallbackResult = await calculateWithClimatiqFallback({
          region: input.region,
          countryName: input.country_name,
          category: item.category,
          itemName: item.item_name,
          value: Number(item.value),
          unit: item.unit,
        });

        if (!fallbackResult.success) {
          reviewCount++;

          results.push({
            item_name: item.item_name,
            category: item.category,
            value: item.value,
            unit: item.unit,
            status: "review",
            source_engine: "official_factor_db_then_climatiq",
            region: input.region,
            reason: "UNIT_MISMATCH_AND_CLIMATIQ_FAILED",
            message: fallbackResult.message,
            factor_unit: factor.unit,
            factor_name: factor.name,
          });

          continue;
        }

        calculatedCount++;
        totalCo2e += fallbackResult.co2e;

        results.push({
          item_name: item.item_name,
          category: item.category,
          value: item.value,
          unit: item.unit,
          status: "calculated",
          source_engine: "climatiq",
          fallback_used: true,
          fallback_reason: "LOCAL_UNIT_MISMATCH",
          region: input.region,
          country_name: input.country_name,
          activity_id: fallbackResult.activity_id,
          parameter_name: fallbackResult.parameter_name,
          parameter_unit: fallbackResult.parameter_unit,
          converted: fallbackResult.converted,
          co2e: fallbackResult.co2e,
          co2e_unit: fallbackResult.co2e_unit,
          factor_name: fallbackResult.factor_name,
          factor_source: fallbackResult.factor_source,
          factor_region: fallbackResult.factor_region,
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
