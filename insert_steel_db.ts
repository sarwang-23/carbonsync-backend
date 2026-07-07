import { pool } from "./src/db.js";

async function run() {
  try {
    const mappings = [
      { cat: 'finished_steel', act: 'metals-type_iron_and_non_alloy_steel_in_bars_and_rods', kw: '{"tmt", "rebar", "bar", "rod"}' },
      { cat: 'structural_steel', act: 'metals-type_iron_and_non_alloy_steel_angles_shapes_sections', kw: '{"angle", "channel", "beam", "joist"}' },
      { cat: 'steel_plate', act: 'metals-type_flat_rolled_products_iron_or_non_alloy_steel', kw: '{"plate"}' },
      { cat: 'steel_sheet', act: 'metals-type_flat_rolled_products_iron_or_non_alloy_steel', kw: '{"sheet"}' },
      { cat: 'steel_coil', act: 'metals-type_flat_rolled_products_iron_or_non_alloy_steel', kw: '{"coil"}' },
      { cat: 'steel_pipe', act: 'metals-type_tubes_pipes_hollow_profiles_seamless_of_iron_or_steel', kw: '{"pipe", "tube"}' },
      { cat: 'sponge_iron', act: 'metals-type_ferrous_products_obtained_by_direct_reduction_of_iron_ore', kw: '{"sponge iron", "dri"}' },
      { cat: 'pig_iron', act: 'metals-type_pig_iron_spiegeleisen_in_pigs_blocks', kw: '{"pig iron"}' },
      { cat: 'cast_iron', act: 'metals-type_cast_iron_tube_pipe_fittings', kw: '{"cast iron"}' },
      { cat: 'ingot', act: 'metals-type_iron_and_non_alloy_steel_in_ingots', kw: '{"ingot"}' },
      { cat: 'ferro_alloy', act: 'metals-type_ferro_alloys', kw: '{"ferro"}' },
      { cat: 'iron_ore', act: 'metals-type_iron_ores_concentrates', kw: '{"iron ore"}' },
      { cat: 'iron_powder', act: 'metals-type_powders_of_pig_iron_spiegeleisen_iron_or_steel', kw: '{"iron powder"}' },
      { cat: 'steel_powder', act: 'metals-type_powders_of_pig_iron_spiegeleisen_iron_or_steel', kw: '{"steel powder"}' },
      { cat: 'quartz', act: 'mined_materials-type_quartz_mica_nonmetallic_minerals_mining_and_quarrying', kw: '{"quartz"}' },
      { cat: 'bentonite', act: 'mined_materials-type_clay_and_ceramic_and_refractory_minerals_mining_and_quarrying', kw: '{"bentonite"}' }
    ];
    
    const regions = [
        { r: 'IN', c: 'India' },
        { r: 'AU', c: 'Australia' },
        { r: 'US', c: 'United States' },
        { r: 'GB', c: 'United Kingdom' }
    ];
    
    for (const {r, c} of regions) {
      for (const {cat, act, kw} of mappings) {
        const existing = await pool.query("SELECT id FROM emission_factor_mappings WHERE region = $1 AND category = $2", [r, cat]);
        if (existing.rows.length === 0) {
            await pool.query(`
                INSERT INTO emission_factor_mappings 
                (region, country_name, category, keywords, activity_id, preferred_source, preferred_lca_activity, parameter_name, parameter_unit, is_active, data_version)
                VALUES 
                ($1, $2, $3, $4, $5, 'Climatiq', 'production', 'weight', 'kg', true, '^6')
            `, [r, c, cat, kw, act]);
        } else {
            await pool.query(`
                UPDATE emission_factor_mappings 
                SET activity_id = $2, parameter_name = 'weight', parameter_unit = 'kg'
                WHERE region = $1 AND category = $3
            `, [r, act, cat]);
        }
      }
    }
    console.log("Inserted advanced steel fallback mappings successfully.");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
