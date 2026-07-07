import { pool } from "./src/db.js";

async function run() {
  try {
    const activityId = 'building_materials-type_aggregates_primary_material_production';
    
    // Insert for India, Australia, UK, US, and generic GLO
    const regions = [
        { r: 'IN', c: 'India' },
        { r: 'AU', c: 'Australia' },
        { r: 'US', c: 'United States' },
        { r: 'GB', c: 'United Kingdom' }
    ];
    
    for (const {r, c} of regions) {
        const existing = await pool.query("SELECT id FROM emission_factor_mappings WHERE region = $1 AND category = 'limestone'", [r]);
        if (existing.rows.length === 0) {
            await pool.query(`
                INSERT INTO emission_factor_mappings 
                (region, country_name, category, keywords, activity_id, preferred_source, preferred_lca_activity, parameter_name, parameter_unit, is_active, data_version)
                VALUES 
                ($1, $2, 'limestone', ARRAY['limestone', 'dolomite', 'quick lime'], $3, 'Climatiq', 'production', 'weight', 'kg', true, '^6')
            `, [r, c, activityId]);
        } else {
            await pool.query(`
                UPDATE emission_factor_mappings 
                SET activity_id = $2, parameter_name = 'weight', parameter_unit = 'kg'
                WHERE region = $1 AND category = 'limestone'
            `, [r, activityId]);
        }
    }
    console.log("Inserted limestone fallback mappings successfully.");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
