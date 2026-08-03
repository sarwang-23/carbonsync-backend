import { pool } from "../db.js";
import { estimateWithClimatiqDirect } from "./climatiq.service.js";
import { searchClimatiqFactor } from "./ClimatiqSearch.service.js";
import { normalizeUnit } from "./UnitConversion.service.js";

type IndiaClimatiqFallbackInput = {
  category: string;
  itemName: string;
  value: number;
  unit: string;
  amount?: number;   // invoice line total (for spend-based categories)
  currency?: string; // e.g. "inr"
};

const CLIMATIQ_CATEGORY_MAPPING: Record<string, string> = {
  "finished_steel": "steel",
  "semi_finished_steel": "steel",
  "raw_material_steel": "steel",
  "stainless_steel": "stainless steel",
  "alloy_steel": "alloy steel",
  "pig_iron": "pig iron",
  "dri": "direct reduced iron",
  "billet": "steel billet",
  "bloom": "steel bloom",
  "slab": "steel slab",
  "steel_scrap": "steel scrap",
  "ferro_alloy": "ferro alloy",
  "limestone": "limestone",
  "dolomite": "dolomite",
  "coke": "coke",
  "iron_ore": "iron ore",
  // newly added
  "coal": "coal",
  "lime": "lime",
  "cement": "cement",
  "refractory": "refractory",
  "industrial_gas": "industrial gas",
  "bauxite": "bauxite",
  "aggregates": "aggregates",
  "cast_iron": "cast iron",
  "aluminium": "aluminium",
  "chemicals": "chemicals",
  "plastic": "plastic material",
  "glass": "glass",
  "paper": "paper",
  "wood": "timber wood",
  "textile": "textile material",
  "food": "food product",
  "agriculture": "agricultural product",
  "electronics": "electronics",
  "automotive": "automotive parts",
  "construction": "construction material",
};


const WEIGHT_CATEGORIES = [
  "steel",
  "finished_steel",
  "semi_finished_steel",
  "raw_material_steel",
  "stainless_steel",
  "alloy_steel",
  "steel_sheet",
  "steel_plate",
  "steel_coil",
  "steel_pipe",
  "structural_steel",
  "aluminium",
  "lpg",
  "coal",
  "coke",
  "limestone",
  "dolomite",
  "ferro_alloy",
  "iron_ore",
  "pig_iron",
  "dri",
  "billet",
  "bloom",
  "slab",
  "steel_scrap",
  "cement",
  "concrete",
  "glass",
  "paper",
  "wood",
  "food",
  "agriculture",   // weight-based (kg/tonne)
  "refrigerant",
  "waste",
  "lime",
  "refractory",
  "industrial_gas",
  "bauxite",
  "aggregates",
  "cast_iron",
];

const ENERGY_CATEGORIES = ["diesel", "petrol", "natural_gas"];

const VOLUME_CATEGORIES = ["water"];

const DISTANCE_CATEGORIES = ["transport"];

const MONEY_CATEGORIES = [
  "hotel",
  "banking",
  "university",
  "exporter",
  "manufacturing",
  "services",
  "electrical",
  "electronics",    // spend-based EEIO
  "automotive",     // spend-based EEIO
  "chemicals",      // spend-based EEIO
  "plastic",        // spend-based EEIO
  "textile",
];

/**
 * Region fallback order for Climatiq estimate calls.
 * India first, then major global regions, finally undefined (GLOBAL).
 */
const REGION_FALLBACK_ORDER: (string | undefined)[] = [
  // Primary: India + major markets
  "IN", "AU", "US", "EU",
  // MRIO country codes (chemicals, electronics, automotive, plastic datasets)
  "GB", "DE", "FR",
  // Ecoinvent regional groupings (glass, timber)
  "ECOINVENT_EUROPE",
  // Final fallbacks
  "GLO", "RoW", undefined,
];

/**
 * Prioritized list of Climatiq activity_ids per category.
 * Engine tries each activity_id × each region until first success.
 * Add new IDs at the top of each array (highest priority first).
 */
const CATEGORY_ACTIVITY_MAP: Record<string, string[]> = {

  // ── Chemicals ─────────────────────────────────────────────────────────────
  chemicals: [
    // Verified from Climatiq search API — MRIO spend-based (money unit)
    "chemicals-type_all_other_chemical_product_and_preparation_manufacturing",
    "chemicals-type_soap_cleaning_compound_and_toilet_preparation_manufacturing",
    "chemicals-type_pharmaceutical_and_medicine_manufacturing",
    "chemicals-type_basic_chemical_manufacturing",
    "chemicals-type_resin_and_synthetic_rubber_and_artificial_synthetic_fibers_and_filaments_manufacturing",
  ],

  // ── Plastic ───────────────────────────────────────────────────────────────
  plastic: [
    // Verified from Climatiq search API — MRIO spend-based (money unit)
    "plastics_rubber-type_rubber_plastic_products",
    "plastics_rubber-type_plastics_in_primary_forms",
    "plastics_rubber-type_plastic_packaging",
    "plastics_rubber-type_plastic_products",
    "plastics_rubber-type_rubber_products",
  ],

  // ── Glass ─────────────────────────────────────────────────────────────────
  glass: [
    // Verified from Climatiq search API — weight-based (kg unit), region DE/ECOINVENT_EUROPE
    "glass_products-type_flat_glass",
    "glass_products-type_glass_container_flat",
    "glass_products-type_flat_glass_press_glass_holding_sa_float_glass_transparent_infill",
    "glass_products-type_flat_glass_press_glass_holding_sa_laminated_safety_glass_transparent_infill",
    "glass_products-type_flat_glass_press_glass_holding_sa_thermally_toughened_safety_glass_transparent_infill",
    "building_materials-type_glass",
  ],

  // ── Textiles ─────────────────────────────────────────────────────────────
  textile: [
    "textiles-type_fabric_mills",
    "textiles-type_textile_and_fabric_finishing_and_fabric_coating_mills",
    "textiles-type_textiles",
    "textiles-type_fiber_yarn_and_thread_mills",
    "consumer_goods-type_apparel_manufacturing",
    "textiles-type_other_textile_product_mills",
  ],

  
  

  // ── Paper & Packaging ─────────────────────────────────────────────────────
  paper: [
    "paper_products-type_express_package_box", // confirmed working
    "paper_products-type_paper",
    "paper_products-type_paper_and_paperboard",
    "paper_products-type_corrugated_paper_and_paperboard",
    "paper_products-type_kraft_paper",
    "paper_products-type_recycled_paper",
    "paper_products-type_tissue_paper",
    "consumer_goods-type_paper_packaging",
    "manufactured_goods-type_paper_products",
  ],

  

  

  // ── Food & Beverage ───────────────────────────────────────────────────────
  food: [
    // Verified from Climatiq search API — weight-based (kg), GLOBAL region
    "food-type_pork-origin_region_world_average",
    "food-type_beef-origin_region_world_average",
    "food-type_lamb-origin_region_world_average",
    "food-type_milk-origin_region_world_average",
    "food-type_chicken-origin_region_world_average",
    "food-type_processed_onions-origin_region_uk",          // confirmed working at GLO region
    "manufactured_goods-type_food_products",
  ],

  // ── Agriculture ───────────────────────────────────────────────────────────
  agriculture: [
    "land_use-type_crop_residues",                          // confirmed working in past tests
    // Verified from Climatiq search API — weight-based (kg), FR/GLOBAL region
    "food-type_rapeseed_average_from_7_optimized_case_study_protein_crop_scenario_at_farm_gate-origin_region_france",
    "food-type_sunflower_grain_average_from_2_optimized_case_study_protein_crop_scenario_at_farm_gate-origin_region_france",
    "food-type_grain_maize_average_from_6_optimized_case_study_scenario_protein_crop_at_farm_gate-origin_region_france",
    "food-type_pork-origin_region_world_average",           // fallback to food/weight
    "food-type_beef-origin_region_world_average",
  ],

  // ── Electronics ───────────────────────────────────────────────────────────
  electronics: [
    // Verified from Climatiq search API — MRIO spend-based (money unit)
    "electronics-type_electronic_computer",
    "electronics-type_other_electronic_component",
    "electronics-type_electronic_connectors_and_other_electronic_components",
    "electronics-type_audio_and_video_equipment",
    "electrical_equipment-type_electrical_equipment",
    "electrical_equipment-type_motors",
    "electrical_equipment-type_lighting",
  ],

  // ── Automotive ────────────────────────────────────────────────────────────
  automotive: [
    // Verified from Climatiq search API — MRIO spend-based (money unit)
    "vehicle_parts-type_other_motor_vehicle_parts_manufacturing",
    "vehicle_parts-type_motor_vehicle_seating_and_interior_trim_manufacturing",
    "vehicle_parts-type_motor_vehicle_electrical_and_electronic_equipment_manufacturing",
    "vehicle_parts-type_motor_vehicle_body_manufacturing",
    "vehicle_parts-type_motor_vehicle_parts_and_accessories",
  ],

  // ── Construction Materials ────────────────────────────────────────────────
  construction: [
    "building_materials-type_average_construction_primary_material_production", // confirmed working
    "building_materials-type_bricks",
    "building_materials-type_ceramic_tiles",
    "building_materials-type_stone",
    "building_materials-type_sand_and_gravel",
    "building_materials-type_construction_materials",
    "manufactured_goods-type_construction_materials",
    "manufactured_goods-type_manufactured_goods",
  ],

  // ── Steel (generic) ───────────────────────────────────────────────────────
  steel: [
    "metals-type_steel_engineering_steel", // confirmed working
    "metals-type_iron_non_alloy_steel",
  ],

  // ── Aluminium ──────────────────────────────────────────────────────────────
  aluminium: [
    "metals-type_primary_aluminium",
    "metals-type_aluminium_primary_aluminium_ingot",
    "metals-type_secondary_aluminium",
    "metals-type_aluminium_secondary_aluminium_ingot",
    "metals-type_aluminium_ingot",
    "metals-type_aluminium_billet",
    "metals-type_aluminium_slab",
    "metals-type_aluminium_extrusion",
    "metals-type_aluminium_sheet",
    "metals-type_aluminium_plate",
    "metals-type_aluminium_coil",
    "metals-type_aluminium_foil",
    "metals-type_aluminium_profile",
    "metals-type_aluminium_casting",
    "metals-type_aluminium_alloy",
    "metals-type_aluminium_scrap",
    "metals-type_recycled_aluminium",
    "metals-type_aluminium_products",
    "metals-type_aluminium_metal",
    "metals-type_aluminium",
  ],

  // ── Steel (finished) ───────────────────────────────────────────────────────
  finished_steel: [
    "metals-type_iron_non_alloy_steel_bars_rods_nec",
    "metals-type_iron_non_alloy_steel_hot_rolled_drawn_extruded_bars_rods_long",
    "metals-type_steel_bars_and_rods",
    "metals-type_iron_non_alloy_steel_other_bars_rods",
    "metals-type_iron_non_alloy_steel_flat_rolled_products",
    "metals-type_hot_rolled_coil",
    "metals-type_iron_non_alloy_steel",
  ],

  // ── Steel Sheet ────────────────────────────────────────────────────────────
  steel_sheet: [
    "metals-type_steel_sheet_galvanized",
    "metals-type_stainless_steel_sheet",
    "metal_products-type_stainless_steel_sheet",
    "metals-type_iron_steel_sheet_piling",
    "metals-type_iron_non_alloy_steel_flat_rolled_products",
    "metals-type_iron_non_alloy_steel_cold_rolled_sheet",
    "metals-type_iron_non_alloy_steel_hot_rolled_sheet",
    "metals-type_iron_non_alloy_steel_galvanised_sheet",
    "metals-type_iron_non_alloy_steel_coated_sheet",
    "metals-type_hot_rolled_coil",
  ],

  // ── Steel Plate ────────────────────────────────────────────────────────────
  steel_plate: [
    "metals-type_steel_plate",
    "metals-type_heavy_plate_steel_sheets",
    "metal_products-type_structural_steel_heavy_plates",
    "metal_products-type_heavy_plates_steel_sheets",
    "metal_products-type_structural_steel_sections_and_plates",
    "metals-type_iron_non_alloy_steel_flat_rolled_products",
    "metals-type_iron_non_alloy_steel_heavy_plate",
    "metals-type_iron_non_alloy_steel_plate",
  ],

  // ── Steel Coil ─────────────────────────────────────────────────────────────
  steel_coil: [
    "metals-type_steel_cold_rolled_coil",
    "metals-type_steel_hot_rolled_coil",
    "metal_products-type_hot_rolled_steel_coil",
    "metals-type_steel_finished_cold_rolled_coil",
    "metals-type_steel_pickled_hot_rolled_coil",
    "metals-type_iron_non_alloy_steel_flat_rolled_products",
    "metals-type_iron_non_alloy_steel_cold_rolled_coil",
  ],

  // ── Steel Pipe ─────────────────────────────────────────────────────────────
  steel_pipe: [
    "metals-type_iron_non_alloy_steel_hollow_sections",
    "metals-type_iron_non_alloy_steel_tubes_pipes",
    "metals-type_iron_non_alloy_steel_seamless_tube",
    "metals-type_iron_non_alloy_steel",
  ],

  // ── Structural Steel ───────────────────────────────────────────────────────
  structural_steel: [
    "metals-type_iron_non_alloy_steel_sections",
    "metals-type_iron_non_alloy_steel_h_sections",
    "metals-type_iron_non_alloy_steel_bars_rods_nec",
    "metals-type_iron_non_alloy_steel",
  ],


  // ── Semi-finished steel ────────────────────────────────────────────────────
  semi_finished_steel: [
    "metals-type_iron_non_alloy_steel_bars_rods_nec",
    "metals-type_iron_non_alloy_steel_semis_billets_blooms_slabs",
    "metals-type_steel_billet",
    "metals-type_iron_non_alloy_steel",
  ],

  // ── Billet ─────────────────────────────────────────────────────────────────
  billet: [
    "metals-type_iron_non_alloy_steel_semis_billets_blooms_slabs",
    "metals-type_steel_billet",
    "metals-type_iron_non_alloy_steel_bars_rods_nec",
    "metals-type_iron_non_alloy_steel",
  ],

  // ── Steel scrap ────────────────────────────────────────────────────────────
  steel_scrap: [
    "metals-type_steel_scrap",
    "metals-type_iron_non_alloy_steel_scrap",
    "metals-type_ferrous_scrap",
    "metals-type_iron_non_alloy_steel",
  ],

  // ── Stainless steel ────────────────────────────────────────────────────────
  stainless_steel: [
    "metals-type_stainless_steel_bars_rods_hot_rolled_coils",
    "metals-type_stainless_steel",
    "metals-type_iron_non_alloy_steel_bars_rods_nec",
  ],

  // ── Iron ore ───────────────────────────────────────────────────────────────
  iron_ore: [
    "metals-type_iron_ores_concentrates",
    "metals-type_iron_ore_pellets",
    "metals-type_iron_ore_sinter",
    "metals-type_iron_ore_fines",
    "metals-type_iron_ore",
  ],

  // ── Pig iron ───────────────────────────────────────────────────────────────
  pig_iron: [
    "metals-type_pig_iron",
    "metals-type_basic_pig_iron",
    "metals-type_foundry_pig_iron",
    "metals-type_iron_non_alloy_steel",
  ],

  // ── DRI / Sponge iron ──────────────────────────────────────────────────────
  dri: [
    "metals-type_direct_reduced_iron",
    "metals-type_sponge_iron",
    "metals-type_hot_briquetted_iron",
    "metals-type_iron_non_alloy_steel",
  ],

  // ── Ferro alloys ───────────────────────────────────────────────────────────
  ferro_alloy: [
    "metals-type_ferro_alloys_ferro_nickel",
    "metals-type_ferro_alloys_ferro_manganese",
    "metals-type_ferro_alloys_ferro_chromium",
    "metals-type_ferro_alloys_ferro_silicon",
    "metals-type_ferro_alloys",
    "metals-type_ferro_silicon",
    "metals-type_ferro_manganese",
    "metals-type_ferro_chrome",
  ],

  // ── Coke ───────────────────────────────────────────────────────────────────
  coke: [
    "fuel-type_coke_oven_coke_and_lignite_coke-fuel_use_na",
    "fuel-type_coking_coal-fuel_use_na",
    "fuel-type_coal_coking-fuel_use_na",
    "fuel-type_coke-fuel_use_na",
    "materials-type_coke",
  ],

  // ── Coal ───────────────────────────────────────────────────────────────────
  coal: [
    "fuel-type_coal_bituminous-fuel_use_na",
    "fuel-type_coal_sub_bituminous-fuel_use_na",
    "fuel-type_coal_anthracite-fuel_use_na",
    "fuel-type_coal_lignite-fuel_use_na",
    "fuel-type_thermal_coal-fuel_use_na",
    "fuel-type_coal-fuel_use_na",
  ],

  // ── Limestone ──────────────────────────────────────────────────────────────
  limestone: [
    "building_materials-type_aggregates_primary_material_production",
    "building_materials-type_limestone",
    "materials-type_limestone",
    "building_materials-type_stone",
    "building_materials-type_aggregate",
  ],

  // ── Cement ─────────────────────────────────────────────────────────────────
  cement: [
    "building_materials-type_cement_average",
    "building_materials-type_portland_cement",
    "building_materials-type_cement_general_purpose",
    "building_materials-type_cement",
    "materials-type_cement",
  ],

  // ── Copper ─────────────────────────────────────────────────────────────────
  copper: [
    "metals-type_copper_cathode",
    "metals-type_copper_wire_rod",
    "metals-type_copper_ingot",
    "metals-type_copper_primary",
    "metals-type_copper_secondary",
    "metals-type_copper",
  ],

  // ── Zinc ───────────────────────────────────────────────────────────────────
  zinc: [
    "metals-type_zinc_primary",
    "metals-type_zinc_ingot",
    "metals-type_zinc_secondary",
    "metals-type_zinc",
  ],

  // ── Lead ───────────────────────────────────────────────────────────────────
  lead: [
    "metals-type_lead_primary",
    "metals-type_lead_ingot",
    "metals-type_lead_secondary",
    "metals-type_lead",
  ],

  // ── Nickel ─────────────────────────────────────────────────────────────────
  nickel: [
    "metals-type_nickel_primary",
    "metals-type_nickel_refined",
    "metals-type_nickel",
  ],

  

  

  

  // ── Electrical ─────────────────────────────────────────────────────────────
  electrical: [
    "electrical_equipment-type_electrical_equipment",
    "electrical_equipment-type_lighting",
    "electrical_equipment-type_motors",
    "manufactured_goods-type_electrical_equipment",
    "manufactured_goods-type_capital_goods",
  ],

  // ── Wood & Timber ──────────────────────────────────────────────────────────
  wood: [
    "timber_forestry-type_timber_softwood",
    "timber_forestry-type_timber_hardwood",
    "timber_forestry-type_hardwood_lumber",
    "timber_forestry-type_egger_timber_structural_timber",
    "timber_forestry-type_rubner_sawn_timber_rubner_sawn_timber_kiln_dried_rubner_sawn_timber_machine_graded_structural_timber",
    "timber_forestry-type_timber_plywood",
    "timber_forestry-type_plywood_board_generic",
    "timber_forestry-type_timber_particle_board",
    "timber_forestry-type_particle_board_raw",
    "timber_forestry-type_timber_mdf",
    "timber_forestry-type_medium_density_fibreboard_mdf_wood_fibre_boards",
    "timber_forestry-type_timber_osb",
    "timber_forestry-type_timber_parquet",
    "timber_forestry-type_timber_laminate",
    "timber_forestry-type_timber_open_panel_timber_frame_system",
    "timber_forestry-type_timber_closed_panel_timber_frame_system",
    "consumer_goods-type_plywood_veneer",
    "timber_forestry-type_veneer_and_plywood",
    "consumer_goods-type_wooden_windows_door_flooring",
    "building_materials-type_group_folding_door_wooden-scenario_standard",
    "building_materials-type_group_sliding_door_scandinavian_wooden-scenario_standard",
  ],

  // ── Lime ───────────────────────────────────────────────────────────────────
  lime: [
    "manufacturing-type_lime_production",
    "manufacturing-type_magnesian_lime_production",
    "manufacturing-type_dolomitic_lime_production",
  ],

  // ── Refractory ─────────────────────────────────────────────────────────────
  refractory: [
    "ceramics-type_clay_and_ceramic_products_and_refractories",
  ],

  // ── Industrial Gas ─────────────────────────────────────────────────────────
  industrial_gas: [
    "chemicals-type_industrial_gas",
  ],

  // ── Bauxite ────────────────────────────────────────────────────────────────
  bauxite: [
    "mining-type_bauxite_mining",
  ],

  // ── Aggregates ─────────────────────────────────────────────────────────────
  aggregates: [
    "building_materials-type_concrete_paving_stone_stonecycle_with_over_40_percent_recycled_aggregates_ready_mixed",
    "building_materials-type_aggregates_primary_material_production",
    "building_materials-type_aggregate",
    "building_materials-type_sand_and_gravel",
  ],

  // ── Cast Iron ──────────────────────────────────────────────────────────────
  cast_iron: [
    "metals-type_grey_cast_iron_part_cast_or_forged_steel_and_iron_items",
    "metals-type_cast_iron",
  ],

};

function convertForClimatiq(input: {
  category: string;
  value: number;
  unit: string;
  amount?: number;
  currency?: string;
  expectedParameterName: string | null;
  expectedParameterUnit: string | null;
}) {
  const unit = normalizeUnit(input.unit);

  // ── Money/spend-based categories (HIGHEST PRIORITY) ─────────────────────────
  if (
    input.expectedParameterName === "money" ||
    MONEY_CATEGORIES.includes(input.category)
  ) {
    const val = input.amount !== undefined ? input.amount : input.value;
    const fallbackUnit = input.currency ? input.currency.toLowerCase() : "inr";
    let paramUnit = fallbackUnit;
    if (input.expectedParameterUnit && ["usd","eur","gbp","inr","aud"].includes(input.expectedParameterUnit.toLowerCase())) {
      paramUnit = input.expectedParameterUnit.toLowerCase();
    }
    return {
      value: val,
      parameterName: "money",
      parameterUnit: paramUnit,
      converted: input.amount !== undefined,
      conversion_note: input.amount !== undefined ? "Used invoice line amount for spend-based emission calculation" : undefined,
    };
  }

  // ── Weight-based categories ─────────────────────────────────────────────
  if (
    input.expectedParameterName === "weight" ||
    WEIGHT_CATEGORIES.includes(input.category)
  ) {
    if (unit === "kg") {
      return {
        value: input.value,
        parameterName: "weight",
        parameterUnit: "kg",
        converted: false,
      };
    }

    if (unit === "tonne" || unit === "t") {
      return {
        value: input.value * 1000,
        parameterName: "weight",
        parameterUnit: "kg",
        converted: true,
        conversion_note: "Converted tonne to kg",
      };
    }
  }

  // ── Energy-based categories ─────────────────────────────────────────────
  if (
    input.expectedParameterName === "energy" ||
    ENERGY_CATEGORIES.includes(input.category)
  ) {
    if (unit === "kwh" || unit === "kwj") {
      return {
        value: input.value,
        parameterName: "energy",
        parameterUnit: "kWh",
        converted: false,
      };
    }

    if (input.category === "diesel" && (unit === "l" || unit === "ltr")) {
      return {
        value: Number((input.value * 10).toFixed(6)),
        parameterName: "energy",
        parameterUnit: "kWh",
        converted: true,
        conversion_note: "Converted diesel litre to kWh using approx 10 kWh/litre",
      };
    }

    if (input.category === "petrol" && (unit === "l" || unit === "ltr")) {
      return {
        value: Number((input.value * 8.9).toFixed(6)),
        parameterName: "energy",
        parameterUnit: "kWh",
        converted: true,
        conversion_note: "Converted petrol litre to kWh using approx 8.9 kWh/litre",
      };
    }
  }

  // ── Volume-based categories ─────────────────────────────────────────────
  if (
    input.expectedParameterName === "volume" ||
    VOLUME_CATEGORIES.includes(input.category)
  ) {
    if (unit === "m3" || unit === "m³" || unit === "cubic metre") {
      return {
        value: input.value,
        parameterName: "volume",
        parameterUnit: "m3",
        converted: false,
      };
    }

    if (unit === "l" || unit === "litre" || unit === "liter") {
      return {
        value: Number((input.value / 1000).toFixed(6)),
        parameterName: "volume",
        parameterUnit: "m3",
        converted: true,
        conversion_note: "Converted litres to m3",
      };
    }
  }

  // ── Distance-based categories ───────────────────────────────────────────
  if (
    input.expectedParameterName === "distance" ||
    DISTANCE_CATEGORIES.includes(input.category)
  ) {
    if (unit === "km" || unit === "kilometer" || unit === "kilometre") {
      return {
        value: input.value,
        parameterName: "distance",
        parameterUnit: "km",
        converted: false,
      };
    }
  }

  // ── Area-based categories ───────────────────────────────────────────────
  if (
    input.expectedParameterName === "area" ||
    unit === "m2" || unit === "sqm" || unit === "sq.mtr." || unit === "sq mtr" || unit === "sq. mtr." || unit === "square meter" || unit === "sq meter" || unit === "sqft" || unit === "squarefoot"
  ) {
    return {
      value: input.value,
      parameterName: "area",
      parameterUnit: unit === "sqft" || unit === "squarefoot" ? "ft2" : "m2",
      converted: false,
    };
  }

  // ── Freight: weight_distance ─────────────────────────────────────────────
  if (
    input.expectedParameterName === "weight_distance" ||
    input.category === "freight"
  ) {
    if (
      unit === "tonnekm" ||
      unit === "tkm"
    ) {
      return {
        value: input.value,
        parameterName: "weight_distance",
        parameterUnit: "tonne-km",
        converted: false,
        parameters: {
          weight: 1,
          weight_unit: "t",
          distance: input.value,
          distance_unit: "km"
        }
      };
    }
  }

  // ── Area → Weight conversion for plastic/textile items (safety nets, shade nets) ─────────
  // Typical nylon / polypropylene safety net density: ~60 g/m²
  // This allows Sq.Mtr. invoices to pass through as kg to Climatiq
  const AREA_TO_WEIGHT_CATEGORIES = ["plastic", "textile", "purchased_goods"];
  if (
    (unit === "m2" || unit === "sqm" || unit === "sqft") &&
    AREA_TO_WEIGHT_CATEGORIES.includes(input.category)
  ) {
    const densityKgPerM2 = 0.06; // ~60 g/m² for nylon safety net / shade net
    const areaM2 = unit === "sqft" ? input.value * 0.0929 : input.value;
    return {
      value: Number((areaM2 * densityKgPerM2).toFixed(4)),
      parameterName: "weight",
      parameterUnit: "kg",
      converted: true,
      conversion_note: `Converted ${input.value} ${unit} → weight using density 60 g/m² (nylon/polypropylene net)`,
    };
  }

  return {
    value: input.value,
    parameterName: input.expectedParameterName || "weight",
    parameterUnit: input.expectedParameterUnit || input.unit,
    converted: false,
    review_required: true,
    reason: "UNIT_CONVERSION_NOT_SUPPORTED",
  };
}

async function getIndiaFallbackMapping(category: string) {
  try {
    const result = await pool.query(
      `
      select
        id,
        region,
        country_name,
        category,
        keywords,
        activity_id,
        preferred_source,
        preferred_lca_activity,
        parameter_name,
        parameter_unit,
        data_version
      from emission_factor_mappings
      where region = 'IN'
        and category = $1
        and preferred_source = 'Climatiq'
        and is_active = true
      order by id asc
      limit 1
      `,
      [category]
    );

    return result.rows[0] || null;
  } catch (err: any) {
    console.warn(`[IndiaClimatiqFallback] DB Error:`, err.message);
    return null;
  }
}

export async function calculateIndiaClimatiqFallback(
  input: IndiaClimatiqFallbackInput
) {
  const mapping = await getIndiaFallbackMapping(input.category);

  let priorityActivityIds: string[] = [
    ...(CATEGORY_ACTIVITY_MAP[input.category] || []),
  ];

  if (mapping?.activity_id) {
    // DB overrides go to the very front so they are tried first
    priorityActivityIds = [mapping.activity_id, ...priorityActivityIds.filter(id => id !== mapping.activity_id)];
    console.log(`[IN] Injected DB mapping activity ID to top priority: ${mapping.activity_id}`);
  }

  // ── 1. Hardcoded priority mappings → multi-activity + multi-region fallback engine ─────────
  if (priorityActivityIds.length > 0) {
    console.log(`[IN] Using multi-activity fallback engine for "${input.category}" with ${priorityActivityIds.length} IDs`);

    // Infer unit conversion defaults based on category type
    let inferredParameterName = "weight";
    let inferredParameterUnit = "kg";
    const unitNorm = normalizeUnit(input.unit);
    // Check spend first
    if (MONEY_CATEGORIES.includes(input.category)) {
      inferredParameterName = "money";
      inferredParameterUnit = "inr";
    } else if (unitNorm === "m2" || unitNorm === "sqft" || unitNorm === "sqm") {
      inferredParameterName = "area";
      inferredParameterUnit = unitNorm === "sqft" ? "ft2" : "m2";
    } else if (ENERGY_CATEGORIES.includes(input.category)) {
      inferredParameterName = "energy";
      inferredParameterUnit = "kWh";
    } else if (VOLUME_CATEGORIES.includes(input.category)) {
      inferredParameterName = "volume";
      inferredParameterUnit = "m3";
    } else if (DISTANCE_CATEGORIES.includes(input.category)) {
      inferredParameterName = "distance";
      inferredParameterUnit = "km";
    }

    const finalConverted = convertForClimatiq({
      category: input.category,
      value: input.value,
      unit: input.unit,
      amount: input.amount,
      currency: input.currency,
      expectedParameterName: inferredParameterName,
      expectedParameterUnit: inferredParameterUnit,
    });

    // Try each activity_id × each region
    for (const actId of priorityActivityIds) {
      for (const region of REGION_FALLBACK_ORDER) {
        // Try both kg and tonne variants for weight-based categories
        const paramVariants = [
          { parameterName: finalConverted.parameterName, value: finalConverted.value, parameterUnit: finalConverted.parameterUnit },
          ...(finalConverted.parameterName === "weight" && finalConverted.parameterUnit === "kg"
            ? [{ parameterName: "weight", value: Number((finalConverted.value / 1000).toFixed(6)), parameterUnit: "t" }]
            : []),
          ...(finalConverted.parameterName === "weight" && (finalConverted.parameterUnit === "t" || finalConverted.parameterUnit === "tonne")
            ? [{ parameterName: "weight", value: finalConverted.value * 1000, parameterUnit: "kg" }]
            : []),
        ];

        for (const params of paramVariants) {
          try {
            const result = await estimateWithClimatiqDirect({
              activityId: actId,
              parameterName: params.parameterName,
              value: params.value,
              parameterUnit: params.parameterUnit,
              dataVersion: "^6",
              region,
            });

            console.log(`[IN Multi-Fallback] ✅ ${actId} | region=${region ?? "GLOBAL"} | co2e=${result.co2e}`);

            return {
              success: true,
              status: "calculated",
              source_engine: "climatiq",
              preferred_source: "Climatiq",
              region: "IN",
              country_name: "India",
              category: input.category,
              item_name: input.itemName,
              input_value: input.value,
              input_unit: input.unit,
              converted: { ...params },
              activity_id: actId,
              parameter_name: params.parameterName,
              parameter_unit: params.parameterUnit,
              co2e: result.co2e,
              co2e_unit: result.co2e_unit,
              factor_name: result.factor_name,
              factor_source: result.factor_source,
              factor_region: result.factor_region ?? region ?? "GLOBAL",
              raw: result.raw,
            };
          } catch (err: any) {
            const errMsg = String(err?.message || "");
            console.log(`[IN Multi-Fallback] ❌ ${actId} | region=${region ?? "GLOBAL"} | error=${errMsg.substring(0, 50)}`);
            // If the factor doesn't exist for this region, don't waste time trying other unit variants
            if (errMsg.includes("No emission factors could be found") || errMsg.includes("region")) {
                break; // Break inner paramVariants loop, move to next region
            }
            // If it's a unit error or something else, continue trying next param variant
          }
        }
      }
      console.log(`[IN Multi-Fallback] ✗ ${actId} — no region worked`);
    }

    // All activity IDs exhausted — fall through to search fallback
    console.log(`[IN Multi-Fallback] ✗ All ${priorityActivityIds.length} IDs failed for ${input.category}, falling back to smart search`);
  }

  // ── 2. Database mapped logic (for legacy mappings) ─────────
  
  // ─────────────────────────────────────────────────────────────────────────

  const converted = convertForClimatiq({
    category: input.category,
    value: input.value,
    unit: input.unit,
    amount: input.amount,
    currency: input.currency,
    expectedParameterName: mapping?.parameter_name || null,
    expectedParameterUnit: mapping?.parameter_unit || null,
  });

  if ((converted as any).review_required) {
    return {
      success: false,
      status: "review",
      source_engine: "climatiq",
      region: "IN",
      country_name: "India",
      category: input.category,
      value: input.value,
      unit: input.unit,
      reason: (converted as any).reason,
      message: `Unit conversion not supported for ${input.category}: ${input.unit}`,
    };
  }

  let activityId = mapping?.activity_id;
  let targetRegion: string | undefined = "IN";

  if (!activityId) {
    const cleanItemName = input.itemName
      .replace(/[^a-zA-Z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 3)
      .join(" ");

    // ── Smart steel activity mapping ──────────────────────────────────────
    // MS / TMT / billet / round bar → generic "steel bars rods" to avoid
    // picking up "alloy steel forged" factors for ordinary mild steel.
    let searchQuery: string;
    const searchCategory = CLIMATIQ_CATEGORY_MAPPING[input.category] || input.category;
    let genericQuery: string = searchCategory;

    if (input.category === "steel" || input.category === "finished_steel" || input.category === "semi_finished_steel") {
      const nameLower = input.itemName.toLowerCase();
      if (
        nameLower.includes("ms billet") ||
        nameLower.includes("ms bar") ||
        nameLower.includes("tmt") ||
        nameLower.includes("billet") ||
        nameLower.includes("round bar") ||
        nameLower.includes("mild steel")
      ) {
        searchQuery = "steel bars rods";
      } else if (nameLower.includes("sheet") || nameLower.includes("coil") || nameLower.includes("plate")) {
        searchQuery = "steel sheet plate coil";
      } else if (nameLower.includes("pipe") || nameLower.includes("tube")) {
        searchQuery = "steel pipe tube";
      } else {
        searchQuery = `steel ${cleanItemName}`;
      }
    } else {
      const nameLower = input.itemName.toLowerCase();
      // Similar Product Matching
      if (nameLower.includes("door shutter")) {
          searchQuery = "wood door flush door timber products";
      } else if (nameLower.includes("aluminium scrap")) {
          searchQuery = "aluminium secondary scrap recycled";
      } else if (nameLower.includes("coke breeze")) {
          searchQuery = "coke coal breeze solid fuel";
      } else {
          searchQuery = `${searchCategory} ${cleanItemName} India`;
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    let searchedFactor = await searchClimatiqFactor({
      query: searchQuery,
      region: "IN",
      dataVersion: mapping?.data_version || "^6",
      resultsPerPage: 10,
    });
    if (!searchedFactor?.activity_id) {
        searchedFactor = await searchClimatiqFactor({ query: genericQuery, region: "IN", dataVersion: mapping?.data_version || "^6", resultsPerPage: 1 });
    }

    if (!searchedFactor?.activity_id) {
      // Fallback 1: GLOBAL region
      const globalSearchQuery = `${input.category} ${cleanItemName}`;
      searchedFactor = await searchClimatiqFactor({
        query: globalSearchQuery,
        region: "GLO",
        dataVersion: mapping?.data_version || "^6",
        resultsPerPage: 10,
      });
      if (!searchedFactor?.activity_id) {
          searchedFactor = await searchClimatiqFactor({ query: genericQuery, region: "GLO", dataVersion: mapping?.data_version || "^6", resultsPerPage: 1 });
      }
      if (searchedFactor?.activity_id) targetRegion = "GLO";
    }

    if (!searchedFactor?.activity_id) {
      // Fallback 2: RoW region (Rest of World)
      const rowSearchQuery = `${input.category} ${cleanItemName}`;
      searchedFactor = await searchClimatiqFactor({
        query: rowSearchQuery,
        region: "RoW",
        dataVersion: mapping?.data_version || "^6",
        resultsPerPage: 10,
      });
      if (!searchedFactor?.activity_id) {
          searchedFactor = await searchClimatiqFactor({ query: genericQuery, region: "RoW", dataVersion: mapping?.data_version || "^6", resultsPerPage: 1 });
      }
      if (searchedFactor?.activity_id) targetRegion = "RoW";
    }

    if (!searchedFactor?.activity_id) {
      return {
        success: false,
        status: "review",
        source_engine: "climatiq",
        region: "IN",
        country_name: "India",
        category: input.category,
        reason: "CLIMATIQ_FACTOR_NOT_FOUND",
        message: `No Climatiq factor found for India, GLO, or RoW for category: ${input.category}`,
      };
    }

    activityId = searchedFactor.activity_id;
  }

  // Helper: try Climatiq estimate with automatic unit-type retry (Mapped Path)
  const tryClimatiqWithRetryMapped = async (actId: string, region: string | undefined, converted: any) => {
    const paramVariants = [
      // Primary attempt
      { parameterName: converted.parameterName, value: converted.value, parameterUnit: converted.parameterUnit, parameters: (converted as any).parameters },
      // Retry 1: weight -> mass
      ...(converted.parameterName === "weight" ? [{ parameterName: "mass", value: converted.value, parameterUnit: converted.parameterUnit || "kg", parameters: (converted as any).parameters }] : []),
      // Retry 2: mass -> weight
      ...(converted.parameterName === "mass" ? [{ parameterName: "weight", value: converted.value, parameterUnit: converted.parameterUnit || "kg", parameters: (converted as any).parameters }] : []),
      // Retry 3: weight/kg -> weight/t
      ...(converted.parameterName === "weight" && converted.parameterUnit === "kg" ? [{ parameterName: "weight", value: Number((converted.value / 1000).toFixed(6)), parameterUnit: "t", parameters: (converted as any).parameters }] : []),
      // Retry 4: weight/t -> weight/kg
      ...(converted.parameterName === "weight" && (converted.parameterUnit === "t" || converted.parameterUnit === "tonne") ? [{ parameterName: "weight", value: converted.value * 1000, parameterUnit: "kg", parameters: (converted as any).parameters }] : []),
    ];

    for (let attempt = 0; attempt < paramVariants.length; attempt++) {
      try {
        const params = paramVariants[attempt];
        if (attempt > 0) {
          console.log(`[Climatiq Retry ${attempt}] Trying alternate params:`, params);
        }
        const result = await estimateWithClimatiqDirect({
          activityId: actId,
          parameterName: params.parameterName,
          value: params.value,
          parameterUnit: params.parameterUnit,
          dataVersion: mapping.data_version || "^6",
          region,
          parameters: params.parameters
        });
        return { result, usedParams: params };
      } catch (err: any) {
        const errMsg = String(err?.message || "");
        const isUnitError = errMsg.includes("compatible") || errMsg.includes("unit_type") || errMsg.includes("Invalid Climatiq value") || errMsg.includes("no_compatible_unit_types") || errMsg.includes("parameters") || errMsg.includes("incorrect");
        
        // If region specific factor not found, implement IN -> GLO -> RoW fallback
        const isRegionError = errMsg.includes("No emission factors could be found") || errMsg.includes("region");
        
        if (region && isRegionError) {
          console.log(`\n[Climatiq] Region specific factor not found for ${region}. Starting fallback...`);
          
          let regionsToTry: (string | undefined)[] = [];
          if (region === "IN") regionsToTry = ["GLO", "RoW", undefined];
          else if (region === "GLO") regionsToTry = ["RoW", undefined];
          else if (region === "RoW") regionsToTry = [undefined];
          else if (region !== "IN" && region !== "GLO" && region !== "RoW") regionsToTry = ["GLO", "RoW", undefined];
          
          let fallbackSuccess = false;
          let fallbackResult: any = null;
          let lastFallbackError: any = null;

          for (const nextRegion of regionsToTry) {
             console.log(`[Climatiq] Retrying with region: ${nextRegion}...`);
             try {
                const result = await estimateWithClimatiqDirect({
                  activityId: actId,
                  parameterName: paramVariants[attempt].parameterName,
                  value: paramVariants[attempt].value,
                  parameterUnit: paramVariants[attempt].parameterUnit,
                  dataVersion: mapping.data_version || "^6",
                  region: nextRegion,
                  parameters: paramVariants[attempt].parameters
                });
                fallbackResult = { result, usedParams: paramVariants[attempt] };
                fallbackSuccess = true;
                break; // Success! Stop trying next regions
             } catch (fallbackError: any) {
                 lastFallbackError = fallbackError;
                 const fallbackErrMsg = String(fallbackError?.message || "");
                 const isFallbackRegionError = fallbackErrMsg.includes("No emission factors could be found") || fallbackErrMsg.includes("region");
                 
                 if (isFallbackRegionError) {
                     continue; // Try next region in regionsToTry
                 } else {
                     const isFallbackUnitError = fallbackErrMsg.includes("compatible") || fallbackErrMsg.includes("unit_type") || fallbackErrMsg.includes("Invalid Climatiq value") || fallbackErrMsg.includes("no_compatible_unit_types") || fallbackErrMsg.includes("parameters") || fallbackErrMsg.includes("incorrect");
                     if (!isFallbackUnitError || attempt === paramVariants.length - 1) throw fallbackError;
                     break; // Not a region error, but a unit error - break region loop to let outer unit-retry loop continue
                 }
             }
          }
          
          if (fallbackSuccess) return fallbackResult;
          
          // If we exhausted regions or hit a non-region error, let outer loop decide based on isUnitError
          if (!isUnitError || attempt === paramVariants.length - 1) {
              throw lastFallbackError || err;
          }
          continue;
        }

        if (!isUnitError || attempt === paramVariants.length - 1) throw err;
      }
    }
    throw new Error("All Climatiq parameter variants exhausted");
  };

  let climatiqResult: any = null;
  try {
    const { result } = await tryClimatiqWithRetryMapped(activityId, targetRegion, converted);
    climatiqResult = result;
  } catch (error: any) {
    throw error;
  }

  return {
    success: true,
    status: "calculated",
    source_engine: "climatiq",
    preferred_source: "Climatiq",
    region: "IN",
    country_name: "India",
    category: input.category,
    item_name: input.itemName,
    input_value: input.value,
    input_unit: input.unit,
    converted,
    activity_id: activityId,
    parameter_name: converted.parameterName,
    parameter_unit: converted.parameterUnit,
    co2e: climatiqResult.co2e,
    co2e_unit: climatiqResult.co2e_unit,
    factor_name: climatiqResult.factor_name,
    factor_source: climatiqResult.factor_source,
    factor_region: climatiqResult.factor_region,
    raw: climatiqResult.raw,
  };
}
