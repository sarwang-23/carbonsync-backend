import fs from "fs";
import path from "path";
import { insertOfficialFactor } from "./insertOfficialFactor.js";
import { pool } from "../src/db.js";

async function main() {
  const possibleFiles = ["UK(1).json", "UK.json", "UK (1).json", "uk.json"];

const foundFile = possibleFiles.find((file) => fs.existsSync(path.resolve(file)));

if (!foundFile) {
  throw new Error(
    `UK JSON file not found. Tried: ${possibleFiles.join(", ")}`
  );
}

const filePath = path.resolve(foundFile);

  if (!fs.existsSync(filePath)) {
    throw new Error(`UK(1).json not found at: ${filePath}`);
  }

  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const factors = Array.isArray(json) ? json : json.results || json.data || [];

  console.log(`UK factors found: ${factors.length}`);

  let imported = 0;
  let skipped = 0;

  for (const raw of factors) {
    try {
      await insertOfficialFactor({
        ...raw,
        region: raw.region || "GB",
        region_name: raw.region_name || "United Kingdom",
        source:
          raw.source ||
          "UK Department for Energy Security and Net Zero (DESNZ) / DEFRA",
        source_dataset:
          raw.source_dataset || "UK GHG Conversion Factors 2025 (DESNZ/DEFRA)",
        year: raw.year || 2025,
        year_released: raw.year_released || 2025,
      });

      imported++;
    } catch (error: any) {
      skipped++;
      console.warn("Skipped UK factor:", raw?.name, error.message);
    }
  }

  console.log(`UK import completed. Imported: ${imported}, Skipped: ${skipped}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error("UK import failed:", err);
  await pool.end();
  process.exit(1);
});