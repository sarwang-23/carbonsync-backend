const fs = require('fs');

const path = './src/services/IndiaClimatiqFallback.service.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Add categories to mapping
if (!content.includes('"food": "food product"')) {
  content = content.replace(
    '"textile": "textile material",',
    '"textile": "textile material",\n  "food": "food product",\n  "agriculture": "agricultural product",\n  "electronics": "electronics",\n  "automotive": "automotive parts",\n  "construction": "construction material",'
  );
}

// 2. Update MONEY_CATEGORIES and WEIGHT_CATEGORIES
if (!content.includes('"chemicals",\n  "automotive",')) {
  content = content.replace(
    '"plastic",        // Climatiq plastic EF is spend-based (Money unit)\n  "textile",\n]',
    '"plastic",        // Climatiq plastic EF is spend-based (Money unit)\n  "textile",\n  "chemicals",\n  "automotive",\n]'
  );
}
if (!content.includes('"paper",\n  "food",')) {
  content = content.replace(
    'const WEIGHT_CATEGORIES = [\n',
    'const WEIGHT_CATEGORIES = [\n  "paper",\n  "food",\n  "agriculture",\n  "construction",\n'
  );
}

// 3. Inject new categories into CATEGORY_ACTIVITY_MAP if not present
const newCategoriesStr = `
  // ── Chemicals ────────────────────────────────────────────────────────────
  chemicals: [
    "chemicals-type_industrial_gas", // confirmed working
    "chemical_products-type_industrial_chemicals",
    "chemical_products-type_basic_chemicals",
    "chemical_products-type_inorganic_chemicals",
    "chemical_products-type_organic_chemicals",
    "chemical_products-type_chemicals",
    "manufactured_goods-type_chemical_products",
    "manufactured_goods-type_manufactured_goods",
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

  // ── Glass ─────────────────────────────────────────────────────────────────
  glass: [
    "building_materials-type_glass_wool", // confirmed working
    "building_materials-type_glass_flat_glass",
    "building_materials-type_flat_glass",
    "manufactured_goods-type_glass_products",
    "manufactured_goods-type_glass_containers",
    "manufactured_goods-type_manufactured_goods",
  ],

  // ── Plastic ───────────────────────────────────────────────────────────────
  plastic: [
    "plastics_rubber-type_liquid_plastics_for_waterproofing_buildings_based_on_silane_modified_polymer_reaction_resin_on_polyurethane_basis", // confirmed working
    "chemical_products-type_plastic_materials",
    "chemical_products-type_plastics",
    "chemical_products-type_hdpe",
    "chemical_products-type_ldpe",
    "chemical_products-type_polypropylene",
    "chemical_products-type_pvc",
    "chemical_products-type_polyethylene",
    "manufactured_goods-type_plastic_products",
    "manufactured_goods-type_manufactured_goods",
  ],

  // ── Food & Beverage ───────────────────────────────────────────────────────
  food: [
    "food-type_processed_onions-origin_region_uk", // confirmed working
    "food_and_drink-type_food_and_drink",
    "food_and_drink-type_food",
    "food_and_drink-type_beverage",
    "food_and_drink-type_grain_crops",
    "food_and_drink-type_sugar",
    "food_and_drink-type_edible_oils",
    "food_and_drink-type_dairy",
    "manufactured_goods-type_food_products",
  ],

  // ── Agriculture ───────────────────────────────────────────────────────────
  agriculture: [
    "land_use-type_crop_residues", // confirmed working
    "agriculture-type_fertiliser",
    "agriculture-type_fertilizers",
    "agriculture-type_pesticide",
    "agriculture-type_seeds",
    "agriculture-type_crop_production",
    "agriculture-type_animal_feed",
    "agriculture-type_agriculture",
    "manufactured_goods-type_manufactured_goods",
  ],

  // ── Electronics ───────────────────────────────────────────────────────────
  electronics: [
    "consumer_goods_rental-type_consumer_electronics_and_appliances_rental", // confirmed working
    "electronics-type_electronics",
    "electronics-type_computers_and_peripherals",
    "electronics-type_consumer_electronics",
    "manufactured_goods-type_electronics",
    "manufactured_goods-type_electrical_equipment",
    "manufactured_goods-type_capital_goods",
    "manufactured_goods-type_manufactured_goods",
  ],

  // ── Automotive ────────────────────────────────────────────────────────────
  automotive: [
    "vehicle_parts-type_other_motor_vehicle_parts_manufacturing", // confirmed working
    "manufactured_goods-type_motor_vehicles",
    "manufactured_goods-type_automotive_parts",
    "manufactured_goods-type_vehicle_parts",
    "manufactured_goods-type_tyres",
    "manufactured_goods-type_capital_goods",
    "manufactured_goods-type_manufactured_goods",
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
`;

if (!content.includes('food: [')) {
  content = content.replace(
    '// ── Aluminium ──────────────────────────────────────────────────────────────',
    newCategoriesStr + '\n  // ── Aluminium ──────────────────────────────────────────────────────────────'
  );
}

// Remove the duplicate bottom declarations of chemicals, plastic, glass, electronics
content = content.replace(/\/\/\s*──\s*Chemicals\s*─+[\s\S]*?chemicals:\s*\[[\s\S]*?\],/g, '');
content = content.replace(/\/\/\s*──\s*Plastic\s*─+[\s\S]*?plastic:\s*\[[\s\S]*?\],/g, '');
content = content.replace(/\/\/\s*──\s*Glass\s*─+[\s\S]*?glass:\s*\[[\s\S]*?\],/g, '');
content = content.replace(/\/\/\s*──\s*Electrical equipment \/ electronics\s*─+[\s\S]*?electrical:\s*\[[\s\S]*?\],/g, '');
content = content.replace(/electronics:\s*\[[\s\S]*?\],/g, '');

// Re-inject electrical
content = content.replace(
  '// ── Wood & Timber ──────────────────────────────────────────────────────────',
  `// ── Electrical ─────────────────────────────────────────────────────────────
  electrical: [
    "electrical_equipment-type_electrical_equipment",
    "electrical_equipment-type_lighting",
    "electrical_equipment-type_motors",
    "manufactured_goods-type_electrical_equipment",
    "manufactured_goods-type_capital_goods",
  ],

  // ── Wood & Timber ──────────────────────────────────────────────────────────`
);

fs.writeFileSync(path, content);
console.log('Restored all mappings.');
