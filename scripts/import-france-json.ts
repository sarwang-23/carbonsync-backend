import fs from "fs";
import path from "path";
import { insertOfficialFactor } from "./insertOfficialFactor.js";
import { pool } from "../src/db.js";

function safeNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value)
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function getFirst(obj: any, keys: string[]) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return null;
}

async function main() {
  const possibleFiles = [
    "FRANCE.json",
    "France.json",
    "france.json",
    "Base_Carbone_V23.6.json",
    "base_carbone.json",
    "base_carbone_normalized.json"
  ];

  const foundFile = possibleFiles.find((file) =>
    fs.existsSync(path.resolve(file))
  );

  if (!foundFile) {
    throw new Error(`France JSON not found. Tried: ${possibleFiles.join(", ")}`);
  }

  const filePath = path.resolve(foundFile);
  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));

  const factors = Array.isArray(json)
    ? json
    : json.results || json.data || json.factors || [];

  console.log(`France factors found: ${factors.length}`);

  if (factors.length > 0) {
    console.log("Sample keys:", Object.keys(factors[0]).slice(0, 40));
  }

  let imported = 0;
  let skipped = 0;

  for (const raw of factors) {
    const factor =
      safeNumber(raw.factor) ??
      safeNumber(raw.co2e_total) ??
      safeNumber(raw["Total poste non décomposé"]) ??
      safeNumber(raw["Total poste non decompose"]) ??
      safeNumber(raw.total);

    const name =
      raw.name ||
      raw["Nom base français"] ||
      raw["Nom base anglais"] ||
      raw["Nom attribut français"] ||
      raw["Nom attribut anglais"];

    if (!name || factor === null) {
      skipped++;
      continue;
    }

    const rawId =
      raw.id ||
      raw.factor_id ||
      getFirst(raw, [
        "Identifiant de l'élément",
        "Identifiant de l’élément",
        "Identifiant élément",
        "ID",
      ]) ||
      `${name}-${raw.unit || raw["Unité français"] || "unit"}`;

    const cleanId = String(rawId)
      .replace(/\s+/g, "-")
      .replace(/[^\w.-]/g, "");

    try {
      await insertOfficialFactor({
        ...raw,

        id: raw.id || `fr-base-carbone-${cleanId}`,
        factor_id: raw.factor_id || raw.id || `fr-base-carbone-${cleanId}`,
        activity_id: raw.activity_id || `fr-base-carbone-${cleanId}`,

        use_case: raw.use_case || "official_factor",
        name,

        sector:
          raw.sector ||
          getFirst(raw, [
            "Type de l'élément",
            "Type de l’élément",
            "Type élément",
          ]) ||
          null,

        category:
          raw.category ||
          getFirst(raw, ["Code de la catégorie", "Code catégorie"]) ||
          null,

        region: "FR",
        region_name: "France",

        source: raw.source || raw.Source || "ADEME Base Carbone",
        source_dataset: raw.source_dataset || "Base Carbone V23.6",
        source_link: raw.source_link || "Base Carbone upload",

        source_lca_activity:
          raw.source_lca_activity || raw.lca_activity || "official_factor",

        year: raw.year || 2025,
        year_released: raw.year_released || 2025,

        unit_type: raw.unit_type || null,
        unit:
          raw.unit ||
          raw["Unité français"] ||
          raw["Unite français"] ||
          raw["Unité"] ||
          null,

        factor,

        factor_calculation_method:
          raw.factor_calculation_method || "reported",

        factor_calculation_origin:
          raw.factor_calculation_origin || "reported",

        scopes: raw.scopes || [],
        supported_calculation_methods:
          raw.supported_calculation_methods || ["reported"],

        constituent_gases: raw.constituent_gases || {
          co2e_total: factor,
          co2: safeNumber(raw.CO2f || raw.CO2),
          ch4: safeNumber(raw.CH4f || raw.CH4),
          n2o: safeNumber(raw.N2O),
          co2b: safeNumber(raw.CO2b),
          other_ghg: safeNumber(raw["Autres GES"]),
        },

        additional_indicators: raw.additional_indicators || {},
      });

      imported++;
    } catch (error: any) {
      skipped++;
      console.warn("Skipped France factor:", name, error.message);
    }
  }

  console.log(
    `France JSON import completed. Imported: ${imported}, Skipped: ${skipped}`
  );

  await pool.end();
}

main().catch(async (err) => {
  console.error("France JSON import failed:", err);
  await pool.end();
  process.exit(1);
});