import { pool } from "./src/db.js";

const INDIA_MAPPINGS = [
  {
    region: "IN",
    country_name: "India",
    category: "coke",
    keywords: ["coke breeze", "coke", "met coke", "metallurgical coke", "nut coke", "foundry coke", "coke fines", "coke oven coke"],
    activity_id: "fuel-type_coke_oven_coke_and_lignite_coke-fuel_use_na",
    preferred_source: "Climatiq",
    preferred_lca_activity: "fuel_use",
    parameter_name: "weight",
    parameter_unit: "kg",
    data_version: "^6",
    priority: 100,
    confidence_score: 0.95,
    is_active: true,
    notes: "Coke Breeze / Met Coke — CBAM verified",
  },
  {
    region: "IN",
    country_name: "India",
    category: "limestone",
    keywords: ["limestone", "lime stone", "limestone powder", "limestone chips", "limestone fines"],
    activity_id: "building_materials-type_aggregates_primary_material_production",
    preferred_source: "Climatiq",
    preferred_lca_activity: "primary_material_production",
    parameter_name: "weight",
    parameter_unit: "kg",
    data_version: "^6",
    priority: 100,
    confidence_score: 0.90,
    is_active: true,
    notes: "Limestone — BEIS aggregates factor",
  },
  {
    region: "IN",
    country_name: "India",
    category: "iron_ore",
    keywords: ["iron ore", "iron ore fines", "iron ore lumps", "iron ore pellets", "ore fines", "iron fines"],
    activity_id: "metals-type_iron_ores_concentrates",
    preferred_source: "Climatiq",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    data_version: "^6",
    priority: 100,
    confidence_score: 0.93,
    is_active: true,
    notes: "Iron Ore Fines — Climatiq iron ores concentrates",
  },
  {
    region: "IN",
    country_name: "India",
    category: "ferro_alloy",
    keywords: ["ferro silicon", "ferro alloy", "ferro manganese", "ferro chrome", "ferro nickel", "ferrosilicon", "fe si"],
    activity_id: "metals-type_ferro_alloys_ferro_nickel",
    preferred_source: "Climatiq",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    data_version: "^6",
    priority: 100,
    confidence_score: 0.90,
    is_active: true,
    notes: "Ferro Alloys — Climatiq ferro-nickel factor",
  },
  {
    region: "IN",
    country_name: "India",
    category: "dri",
    keywords: ["dri", "direct reduced iron", "sponge iron", "hbi", "hot briquetted iron", "cold dri"],
    activity_id: "metals-type_direct_reduced_iron",
    preferred_source: "Climatiq",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    data_version: "^6",
    priority: 100,
    confidence_score: 0.93,
    is_active: true,
    notes: "DRI / Sponge Iron — Climatiq direct reduced iron",
  },
  {
    region: "IN",
    country_name: "India",
    category: "pig_iron",
    keywords: ["pig iron", "basic pig iron", "foundry pig iron", "steel grade pig iron"],
    activity_id: "metals-type_pig_iron",
    preferred_source: "Climatiq",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    data_version: "^6",
    priority: 100,
    confidence_score: 0.93,
    is_active: true,
    notes: "Pig Iron — Climatiq pig iron factor",
  },
  {
    region: "IN",
    country_name: "India",
    category: "finished_steel",
    keywords: ["tmt bars", "ms bars", "tmt", "rebars", "hrc", "hot rolled coil", "ms rod", "steel bars", "structural steel"],
    activity_id: "metals-type_steel_bars_and_rods",
    preferred_source: "Climatiq",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    data_version: "^6",
    priority: 100,
    confidence_score: 0.90,
    is_active: true,
    notes: "Finished Steel / TMT Bars — Climatiq steel bars and rods",
  },
  {
    region: "IN",
    country_name: "India",
    category: "steel_scrap",
    keywords: ["steel scrap", "scrap", "ms scrap", "iron scrap", "shredded scrap"],
    activity_id: "metals-type_steel_scrap",
    preferred_source: "Climatiq",
    preferred_lca_activity: "production",
    parameter_name: "weight",
    parameter_unit: "kg",
    data_version: "^6",
    priority: 100,
    confidence_score: 0.90,
    is_active: true,
    notes: "Steel Scrap",
  },
  {
    region: "IN",
    country_name: "India",
    category: "coal",
    keywords: ["coal", "thermal coal", "coking coal", "non-coking coal", "steam coal", "pci coal"],
    activity_id: "fuel-type_coal_bituminous-fuel_use_na",
    preferred_source: "Climatiq",
    preferred_lca_activity: "fuel_use",
    parameter_name: "weight",
    parameter_unit: "kg",
    data_version: "^6",
    priority: 100,
    confidence_score: 0.92,
    is_active: true,
    notes: "Coal — bituminous fuel use",
  },
];

async function seedIndiaClimatiqMappings() {
  console.log("Seeding India Climatiq emission_factor_mappings...\n");

  for (const m of INDIA_MAPPINGS) {
    try {
      // Check if already exists
      const existing = await pool.query(
        "SELECT id FROM emission_factor_mappings WHERE region = $1 AND category = $2",
        [m.region, m.category]
      );

      if (existing.rows.length > 0) {
        // UPDATE existing record
        await pool.query(
          `UPDATE emission_factor_mappings
           SET activity_id = $1,
               parameter_name = $2,
               parameter_unit = $3,
               keywords = $4,
               notes = $5,
               priority = $6,
               confidence_score = $7,
               preferred_source = $8,
               preferred_lca_activity = $9,
               is_active = true,
               updated_at = NOW()
           WHERE region = $10 AND category = $11`,
          [
            m.activity_id, m.parameter_name, m.parameter_unit,
            m.keywords, m.notes, m.priority, m.confidence_score,
            m.preferred_source, m.preferred_lca_activity,
            m.region, m.category,
          ]
        );
        console.log(`✅ UPDATED: [IN] ${m.category} → ${m.activity_id}`);
      } else {
        // INSERT new record
        await pool.query(
          `INSERT INTO emission_factor_mappings
             (region, country_name, category, keywords, activity_id,
              preferred_source, preferred_lca_activity, parameter_name,
              parameter_unit, data_version, priority, confidence_score,
              is_active, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            m.region, m.country_name, m.category, m.keywords, m.activity_id,
            m.preferred_source, m.preferred_lca_activity, m.parameter_name,
            m.parameter_unit, m.data_version, m.priority, m.confidence_score,
            m.is_active, m.notes,
          ]
        );
        console.log(`✅ INSERTED: [IN] ${m.category} → ${m.activity_id}`);
      }
    } catch (err: any) {
      console.error(`❌ FAILED: [IN] ${m.category} — ${err.message}`);
    }
  }

  console.log("\n✅ Done seeding India mappings.");
  await pool.end();
}

seedIndiaClimatiqMappings().catch(console.error);
