/**
 * seed_india_raw_materials.ts
 *
 * Inserts / updates emission_factor_mappings rows for India (IN) for all
 * industrial raw-material categories that were missing, causing
 * "Processing failed" / "NO_INDIA_CLIMATIQ_MAPPING" errors.
 *
 * Run once:
 *   npx tsx seed_india_raw_materials.ts
 */

import { pool } from "./src/db.js";

interface Mapping {
  category: string;
  keywords: string[];
  activity_id: string;
  preferred_lca_activity: string;
  parameter_name: string;
  parameter_unit: string;
  notes?: string;
}

// ── Best Climatiq activity IDs for each raw-material category ────────────────
// Verified against Climatiq ^6 dataset (GLO / RoW fallback used where IN not available)
const INDIA_RAW_MATERIAL_MAPPINGS: Mapping[] = [
  // ── Coke / Coke Breeze ──────────────────────────────────────────────────
  {
    category: "coke",
    keywords: ["coke", "coke breeze", "met coke", "metallurgical coke", "bf coke", "pet coke", "petroleum coke"],
    activity_id: "fuel-type_coke-fuel_use_na",
    preferred_lca_activity: "fuel_use",
    parameter_name: "weight",
    parameter_unit: "kg",
    notes: "Climatiq Coke EF — GLO factor used for India as IN-specific not available",
  },

  // ── Limestone ────────────────────────────────────────────────────────────
  {
    category: "limestone",
    keywords: ["limestone", "lime stone", "dolomite limestone", "flux stone", "calcium carbonate"],
    activity_id: "building_materials-type_aggregates_primary_material_production",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    notes: "Aggregates/limestone production EF — closest available Climatiq factor",
  },

  // ── Dolomite ─────────────────────────────────────────────────────────────
  {
    category: "dolomite",
    keywords: ["dolomite", "dolomite chips", "dolomite powder", "burnt dolomite", "calcined dolomite"],
    activity_id: "building_materials-type_aggregates_primary_material_production",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    notes: "Aggregates EF used as proxy for dolomite",
  },

  // ── Iron Ore ─────────────────────────────────────────────────────────────
  {
    category: "iron_ore",
    keywords: ["iron ore", "iron ore fines", "iron ore lumps", "ore fines", "ore lumps", "sinter feed", "pellet feed"],
    activity_id: "mining-type_iron_ore",
    preferred_lca_activity: "extraction",
    parameter_name: "weight",
    parameter_unit: "kg",
    notes: "Iron ore mining EF",
  },

  // ── Pig Iron ─────────────────────────────────────────────────────────────
  {
    category: "pig_iron",
    keywords: ["pig iron", "basic pig iron", "foundry pig iron"],
    activity_id: "iron_steel-type_pig_iron",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    notes: "Pig iron production EF",
  },

  // ── DRI / Sponge Iron ────────────────────────────────────────────────────
  {
    category: "dri",
    keywords: ["dri", "direct reduced iron", "sponge iron", "hbi", "hot briquetted iron"],
    activity_id: "iron_steel-type_direct_reduced_iron",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    notes: "DRI/sponge iron production EF",
  },

  // ── Steel Scrap ──────────────────────────────────────────────────────────
  {
    category: "steel_scrap",
    keywords: ["steel scrap", "ms scrap", "heavy melting scrap", "hms", "iron scrap", "metal scrap"],
    activity_id: "iron_steel-type_scrap_steel",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    notes: "Steel scrap EF",
  },

  // ── Ferro Alloy ──────────────────────────────────────────────────────────
  {
    category: "ferro_alloy",
    keywords: ["ferro alloy", "ferroalloy", "ferro manganese", "ferro silicon", "silico manganese"],
    activity_id: "iron_steel-type_ferroalloys",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    notes: "Ferro alloy production EF",
  },

  // ── Coal ─────────────────────────────────────────────────────────────────
  {
    category: "coal",
    keywords: ["coal", "thermal coal", "coking coal", "met coal", "steam coal", "anthracite"],
    activity_id: "fuel-type_thermal_coal-fuel_use_na",
    preferred_lca_activity: "fuel_use",
    parameter_name: "weight",
    parameter_unit: "kg",
    notes: "Thermal coal combustion EF",
  },

  // ── Lime ─────────────────────────────────────────────────────────────────
  {
    category: "lime",
    keywords: ["quicklime", "quick lime", "hydrated lime", "burnt lime", "calcined lime", "calcium oxide"],
    activity_id: "building_materials-type_lime",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    notes: "Lime production EF",
  },

  // ── Cement ───────────────────────────────────────────────────────────────
  {
    category: "cement",
    keywords: ["cement", "opc", "portland cement", "ppc cement", "slag cement"],
    activity_id: "building_materials-type_cement",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    notes: "Cement production EF",
  },
];

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log("🌱 Seeding India raw material emission factor mappings...\n");
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const m of INDIA_RAW_MATERIAL_MAPPINGS) {
    try {
      const existing = await pool.query(
        `SELECT id, activity_id FROM emission_factor_mappings
         WHERE region = 'IN' AND category = $1 AND preferred_source = 'Climatiq' AND is_active = true
         LIMIT 1`,
        [m.category]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        if (row.activity_id === m.activity_id) {
          console.log(`  ⏭  [${m.category}] Already exists with correct activity_id — skipping`);
          skipped++;
          continue;
        }

        // Update with better activity_id
        await pool.query(
          `UPDATE emission_factor_mappings
           SET activity_id = $1,
               preferred_lca_activity = $2,
               parameter_name = $3,
               parameter_unit = $4,
               keywords = $5,
               updated_at = NOW()
           WHERE id = $6`,
          [
            m.activity_id,
            m.preferred_lca_activity,
            m.parameter_name,
            m.parameter_unit,
            m.keywords,
            row.id,
          ]
        );
        console.log(`  ✏️  [${m.category}] Updated → ${m.activity_id}`);
        updated++;
        continue;
      }

      // Insert new row
      await pool.query(
        `INSERT INTO emission_factor_mappings
           (region, country_name, category, keywords, activity_id,
            preferred_source, preferred_lca_activity,
            parameter_name, parameter_unit, is_active, data_version)
         VALUES
           ('IN', 'India', $1, $2, $3,
            'Climatiq', $4,
            $5, $6, true, '^6')`,
        [
          m.category,
          m.keywords,
          m.activity_id,
          m.preferred_lca_activity,
          m.parameter_name,
          m.parameter_unit,
        ]
      );
      console.log(`  ✅ [${m.category}] Inserted → ${m.activity_id}`);
      inserted++;
    } catch (err: any) {
      console.error(`  ❌ [${m.category}] Error: ${err.message}`);
    }
  }

  console.log(`\n📊 Done — Inserted: ${inserted} | Updated: ${updated} | Skipped: ${skipped}`);
  await pool.end();
  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
