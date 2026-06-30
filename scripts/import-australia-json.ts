import fs from "fs";
import path from "path";
import { insertOfficialFactor } from "./insertOfficialFactor.js";
import { pool } from "../src/db.js";

async function main() {
  const filePath = path.resolve("AUSTRALIA.json");

  if (!fs.existsSync(filePath)) {
    throw new Error(`AUSTRALIA.json not found at: ${filePath}`);
  }

  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const factors = Array.isArray(json) ? json : json.results || json.data || [];

  console.log(`Australia factors found: ${factors.length}`);

  let imported = 0;
  let skipped = 0;

  for (const raw of factors) {
    try {
      await insertOfficialFactor({
        ...raw,
        region: raw.region || "AU",
        region_name: raw.region_name || "Australia",
        source: raw.source || "Australian Government DCCEEW",
        source_dataset:
          raw.source_dataset ||
          "Australian National Greenhouse Accounts Factors 2025",
        year: raw.year || 2025,
        year_released: raw.year_released || 2025,
      });

      imported++;
    } catch (error: any) {
      skipped++;
      console.warn("Skipped AU factor:", raw?.name, error.message);
    }
  }

  console.log(
    `Australia import completed. Imported: ${imported}, Skipped: ${skipped}`
  );

  await pool.end();
}

main().catch(async (err) => {
  console.error("Australia import failed:", err);
  await pool.end();
  process.exit(1);
});