import fs from "fs";
import path from "path";

const RAW_FILE = path.resolve("australia_nga_all_tables_2025.json");
const OUTPUT_FILE = path.resolve("AUSTRALIA.json");

function baseFactor(extra: any) {
  return {
    source: "Australian Government DCCEEW",
    source_dataset: "Australian National Greenhouse Accounts Factors 2025",
    source_link: "Australian National Greenhouse Accounts Factors 2025 uploaded PDF",
    year: 2025,
    year_released: 2025,
    region: "AU",
    region_name: "Australia",
    factor_calculation_method: "ar5",
    supported_calculation_methods: ["ar5"],
    ...extra,
  };
}

function makeElectricityFactor(params: {
  idSuffix: string;
  state: string;
  name: string;
  scope2: number;
  scope3: number;
  keywords: string[];
}) {
  const combined = Number((params.scope2 + params.scope3).toFixed(6));

  return baseFactor({
    id: `au-nga-2025-electricity-${params.idSuffix}-location-based-scope2-scope3`,
    activity_id: `au-electricity-location-based-${params.idSuffix}`,
    use_case: "electricity",
    name: `Electricity - ${params.name} - location based`,
    sector: "Energy",
    category: "Electricity",
    source_lca_activity: "scope_2_scope_3_location_based",
    unit_type: "Energy",
    unit: "kg/kWh",
    factor: combined,
    factor_calculation_origin: "reported_combined",
    scopes: ["2", "3"],
    constituent_gases: {
      co2e_total: combined,
      scope2: params.scope2,
      scope3: params.scope3,
    },
    additional_indicators: {
      state: params.state,
      method: "location_based",
    },
    keywords: ["electricity", "kwh", ...params.keywords],
    description: `Location-based electricity factor calculated as scope 2 ${params.scope2} + scope 3 ${params.scope3} = ${combined} kg CO2e/kWh.`,
  });
}

function makeGridFactor(params: {
  idSuffix: string;
  grid: string;
  name: string;
  factor: number;
  keywords: string[];
}) {
  return baseFactor({
    id: `au-nga-2025-electricity-grid-${params.idSuffix}-scope2`,
    activity_id: `au-electricity-grid-${params.idSuffix}-scope2`,
    use_case: "electricity_grid",
    name: `Electricity grid - ${params.name}`,
    sector: "Energy",
    category: "Electricity grids",
    source_lca_activity: "scope_2_grid",
    unit_type: "Energy",
    unit: "kg/kWh",
    factor: params.factor,
    factor_calculation_origin: "reported",
    scopes: ["2"],
    constituent_gases: {
      co2e_total: params.factor,
    },
    additional_indicators: {
      grid: params.grid,
    },
    keywords: ["electricity", "grid", "kwh", ...params.keywords],
    description: "Scope 2 electricity grid factor.",
  });
}

function makeGaseousFuelFactor(params: {
  idSuffix: string;
  name: string;
  energyContent: number;
  energyUnit: "m3" | "kL";
  combinedGases: number;
  keywords: string[];
}) {
  const factor = Number((params.energyContent * params.combinedGases).toFixed(6));
  const unit = params.energyUnit === "m3" ? "kg/m3" : "kg/kL";

  return baseFactor({
    id: `au-nga-2025-${params.idSuffix}-${params.energyUnit.toLowerCase()}-scope1`,
    activity_id: `au-nga-${params.idSuffix}-${params.energyUnit.toLowerCase()}`,
    use_case: "fuel_combustion",
    name: params.name,
    sector: "Energy",
    category: "Gaseous fuels",
    source_lca_activity: "combustion",
    unit_type: "Volume",
    unit,
    factor,
    factor_calculation_origin: "calculated_from_table_5",
    scopes: ["1"],
    constituent_gases: {
      co2e_total: factor,
      [`energy_content_gj_per_${params.energyUnit.toLowerCase()}`]: params.energyContent,
      combined_gases_kg_per_gj: params.combinedGases,
    },
    additional_indicators: {},
    keywords: params.keywords,
    description: `Final factor calculated as ${params.energyContent} GJ/${params.energyUnit} × ${params.combinedGases} kg CO2e/GJ.`,
  });
}

function makeSolidFuelFactor(params: {
  idSuffix: string;
  name: string;
  energyContentGJPerTonne: number;
  scope1CombinedKgPerGJ: number;
  scope3KgPerGJ: number | null;
  keywords: string[];
}) {
  const combinedEf =
    params.scope1CombinedKgPerGJ + (params.scope3KgPerGJ || 0);

  const factor = Number(
    (params.energyContentGJPerTonne * combinedEf).toFixed(6)
  );

  return baseFactor({
    id: `au-nga-2025-${params.idSuffix}-tonne-${
      params.scope3KgPerGJ === null ? "scope1" : "scope1-scope3"
    }`,
    activity_id: `au-nga-${params.idSuffix}-tonne`,
    use_case: "fuel_combustion",
    name: params.name,
    sector: "Energy",
    category: "Solid fuels",
    source_lca_activity: "combustion",
    unit_type: "Mass",
    unit: "kg/tonne",
    factor,
    factor_calculation_origin: "calculated_from_table_4",
    scopes: params.scope3KgPerGJ === null ? ["1"] : ["1", "3"],
    constituent_gases: {
      co2e_total: factor,
      energy_content_gj_per_tonne: params.energyContentGJPerTonne,
      scope1_combined_kg_per_gj: params.scope1CombinedKgPerGJ,
      scope3_kg_per_gj: params.scope3KgPerGJ,
    },
    additional_indicators: {},
    keywords: params.keywords,
    description:
      params.scope3KgPerGJ === null
        ? `Scope 3 was NE, so factor uses Scope 1 combined only: ${params.energyContentGJPerTonne} × ${params.scope1CombinedKgPerGJ}.`
        : `Final factor calculated as ${params.energyContentGJPerTonne} GJ/t × (${params.scope1CombinedKgPerGJ} + ${params.scope3KgPerGJ}) kg CO2e/GJ.`,
  });
}

function makeLiquidFuelFactor(params: {
  idSuffix: string;
  name: string;
  energyContentGJPerKL: number;
  scope1CombinedKgPerGJ: number;
  scope3KgPerGJ: number | null;
  keywords: string[];
}) {
  const combinedEf =
    params.scope1CombinedKgPerGJ + (params.scope3KgPerGJ || 0);

  const factor = Number((params.energyContentGJPerKL * combinedEf).toFixed(6));

  return baseFactor({
    id: `au-nga-2025-${params.idSuffix}-kl-${
      params.scope3KgPerGJ === null ? "scope1" : "scope1-scope3"
    }`,
    activity_id: `au-nga-${params.idSuffix}-kl`,
    use_case: "fuel_combustion",
    name: params.name,
    sector: "Energy",
    category: "Liquid fuels",
    source_lca_activity: "combustion",
    unit_type: "Volume",
    unit: "kg/kL",
    factor,
    factor_calculation_origin: "calculated_from_table_8",
    scopes: params.scope3KgPerGJ === null ? ["1"] : ["1", "3"],
    constituent_gases: {
      co2e_total: factor,
      energy_content_gj_per_kl: params.energyContentGJPerKL,
      scope1_combined_kg_per_gj: params.scope1CombinedKgPerGJ,
      scope3_kg_per_gj: params.scope3KgPerGJ,
    },
    additional_indicators: {},
    keywords: params.keywords,
    description:
      params.scope3KgPerGJ === null
        ? `Scope 3 was NE, so factor uses Scope 1 combined only.`
        : `Final factor calculated as ${params.energyContentGJPerKL} GJ/kL × (${params.scope1CombinedKgPerGJ} + ${params.scope3KgPerGJ}) kg CO2e/GJ.`,
  });
}

function main() {
  if (!fs.existsSync(RAW_FILE)) {
    console.warn("Raw Australia all-tables JSON not found. Generating AUSTRALIA.json from normalized curated factors.");
  }

  const factors = [
    // Table 1 - Electricity location-based
    makeElectricityFactor({
      idSuffix: "nsw-act",
      state: "NSW_ACT",
      name: "New South Wales and Australian Capital Territory",
      scope2: 0.64,
      scope3: 0.03,
      keywords: ["new south wales", "nsw", "act", "australian capital territory"],
    }),
    makeElectricityFactor({
      idSuffix: "victoria",
      state: "VIC",
      name: "Victoria",
      scope2: 0.78,
      scope3: 0.09,
      keywords: ["victoria", "vic"],
    }),
    makeElectricityFactor({
      idSuffix: "queensland",
      state: "QLD",
      name: "Queensland",
      scope2: 0.67,
      scope3: 0.09,
      keywords: ["queensland", "qld"],
    }),
    makeElectricityFactor({
      idSuffix: "south-australia",
      state: "SA",
      name: "South Australia",
      scope2: 0.22,
      scope3: 0.04,
      keywords: ["south australia", "sa"],
    }),
    makeElectricityFactor({
      idSuffix: "wa-swis",
      state: "WA_SWIS",
      name: "Western Australia SWIS",
      scope2: 0.5,
      scope3: 0.06,
      keywords: ["western australia", "wa", "swis"],
    }),
    makeElectricityFactor({
      idSuffix: "wa-nwis",
      state: "WA_NWIS",
      name: "Western Australia NWIS",
      scope2: 0.56,
      scope3: 0.09,
      keywords: ["western australia", "wa", "nwis"],
    }),
    makeElectricityFactor({
      idSuffix: "tasmania",
      state: "TAS",
      name: "Tasmania",
      scope2: 0.2,
      scope3: 0.03,
      keywords: ["tasmania", "tas"],
    }),
    makeElectricityFactor({
      idSuffix: "nt-dkis",
      state: "NT_DKIS",
      name: "Northern Territory DKIS",
      scope2: 0.56,
      scope3: 0.09,
      keywords: ["northern territory", "nt", "dkis"],
    }),
    makeElectricityFactor({
      idSuffix: "national",
      state: "NATIONAL",
      name: "National",
      scope2: 0.62,
      scope3: 0.07,
      keywords: ["national", "australia"],
    }),

    // Table 2 - Market based
    baseFactor({
      id: "au-nga-2025-electricity-national-market-based-residual-mix-scope2-scope3",
      activity_id: "au-electricity-market-based-national-residual-mix",
      use_case: "electricity",
      name: "Electricity - National residual mix factor - market based",
      sector: "Energy",
      category: "Electricity",
      source_lca_activity: "scope_2_scope_3_market_based",
      unit_type: "Energy",
      unit: "kg/kWh",
      factor: 0.92,
      factor_calculation_origin: "reported_combined",
      scopes: ["2", "3"],
      constituent_gases: {
        co2e_total: 0.92,
        scope2: 0.81,
        scope3: 0.11,
      },
      additional_indicators: {
        state: "NATIONAL",
        method: "market_based_residual_mix",
      },
      keywords: ["electricity", "market based", "residual mix", "national"],
    }),

    // Table 3 - Electricity grid
    makeGridFactor({
      idSuffix: "nem",
      grid: "NEM",
      name: "National Electricity Market (NEM)",
      factor: 0.64,
      keywords: ["nem", "national electricity market"],
    }),
    makeGridFactor({
      idSuffix: "swis",
      grid: "SWIS",
      name: "Western Australia SWIS",
      factor: 0.51,
      keywords: ["swis", "western australia"],
    }),
    makeGridFactor({
      idSuffix: "dkis",
      grid: "DKIS",
      name: "Northern Territory DKIS",
      factor: 0.56,
      keywords: ["dkis", "northern territory", "nt"],
    }),
    makeGridFactor({
      idSuffix: "nwis",
      grid: "NWIS",
      name: "Western Australia NWIS",
      factor: 0.61,
      keywords: ["nwis", "western australia"],
    }),
    makeGridFactor({
      idSuffix: "off-grid",
      grid: "OFF_GRID",
      name: "Off-grid",
      factor: 0.67,
      keywords: ["off-grid", "off grid"],
    }),

    // Table 4 - Solid fuels
    makeSolidFuelFactor({
      idSuffix: "bituminous-coal",
      name: "Bituminous coal",
      energyContentGJPerTonne: 27.0,
      scope1CombinedKgPerGJ: 90.24,
      scope3KgPerGJ: 3.0,
      keywords: ["bituminous coal", "coal", "tonne"],
    }),
    makeSolidFuelFactor({
      idSuffix: "sub-bituminous-coal",
      name: "Sub-bituminous coal",
      energyContentGJPerTonne: 21.0,
      scope1CombinedKgPerGJ: 90.24,
      scope3KgPerGJ: 2.5,
      keywords: ["sub-bituminous coal", "coal", "tonne"],
    }),
    makeSolidFuelFactor({
      idSuffix: "anthracite",
      name: "Anthracite",
      energyContentGJPerTonne: 29.0,
      scope1CombinedKgPerGJ: 90.24,
      scope3KgPerGJ: null,
      keywords: ["anthracite", "coal", "tonne"],
    }),
    makeSolidFuelFactor({
      idSuffix: "brown-coal-lignite",
      name: "Brown coal / lignite",
      energyContentGJPerTonne: 10.2,
      scope1CombinedKgPerGJ: 93.82,
      scope3KgPerGJ: 0.4,
      keywords: ["brown coal", "lignite", "coal", "tonne"],
    }),
    makeSolidFuelFactor({
      idSuffix: "coking-coal",
      name: "Coking coal",
      energyContentGJPerTonne: 30.0,
      scope1CombinedKgPerGJ: 92.03,
      scope3KgPerGJ: 6.4,
      keywords: ["coking coal", "metallurgical coal", "coal", "tonne"],
    }),
    makeSolidFuelFactor({
      idSuffix: "coal-briquettes",
      name: "Coal briquettes",
      energyContentGJPerTonne: 22.1,
      scope1CombinedKgPerGJ: 95.38,
      scope3KgPerGJ: null,
      keywords: ["coal briquettes", "coal", "tonne"],
    }),
    makeSolidFuelFactor({
      idSuffix: "coal-coke",
      name: "Coal coke",
      energyContentGJPerTonne: 27.0,
      scope1CombinedKgPerGJ: 107.23,
      scope3KgPerGJ: null,
      keywords: ["coal coke", "coke", "coal", "tonne"],
    }),
    makeSolidFuelFactor({
      idSuffix: "coal-tar",
      name: "Coal tar",
      energyContentGJPerTonne: 37.5,
      scope1CombinedKgPerGJ: 82.03,
      scope3KgPerGJ: null,
      keywords: ["coal tar", "coal", "tonne"],
    }),

    // Table 5 - Gaseous fuels
    makeGaseousFuelFactor({
      idSuffix: "natural-gas-pipeline",
      name: "Natural gas distributed in a pipeline",
      energyContent: 0.0393,
      energyUnit: "m3",
      combinedGases: 51.53,
      keywords: ["natural gas", "pipeline gas", "gas bill", "m3"],
    }),
    makeGaseousFuelFactor({
      idSuffix: "compressed-natural-gas",
      name: "Compressed natural gas",
      energyContent: 0.0393,
      energyUnit: "m3",
      combinedGases: 51.53,
      keywords: ["compressed natural gas", "cng", "m3"],
    }),
    makeGaseousFuelFactor({
      idSuffix: "unprocessed-natural-gas",
      name: "Unprocessed natural gas",
      energyContent: 0.0393,
      energyUnit: "m3",
      combinedGases: 51.53,
      keywords: ["unprocessed natural gas", "natural gas", "m3"],
    }),
    makeGaseousFuelFactor({
      idSuffix: "liquefied-natural-gas",
      name: "Liquefied natural gas",
      energyContent: 25.3,
      energyUnit: "kL",
      combinedGases: 51.53,
      keywords: ["lng", "liquefied natural gas", "kilolitre", "kl"],
    }),
    makeGaseousFuelFactor({
      idSuffix: "hydrogen",
      name: "Hydrogen",
      energyContent: 0.0122,
      energyUnit: "m3",
      combinedGases: 0.05,
      keywords: ["hydrogen", "m3"],
    }),

    // Table 8 - Liquid fuels starter production factors
    // These are common invoice categories. Add more rows later from table 8 if required.
    makeLiquidFuelFactor({
      idSuffix: "diesel-oil",
      name: "Diesel oil",
      energyContentGJPerKL: 38.6,
      scope1CombinedKgPerGJ: 69.9,
      scope3KgPerGJ: 5.3,
      keywords: ["diesel", "diesel oil", "automotive diesel oil", "ado", "kl", "litre"],
    }),
    makeLiquidFuelFactor({
      idSuffix: "petrol",
      name: "Petrol",
      energyContentGJPerKL: 34.2,
      scope1CombinedKgPerGJ: 67.4,
      scope3KgPerGJ: 5.4,
      keywords: ["petrol", "gasoline", "motor spirit", "ulp", "kl", "litre"],
    }),
  ];

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(factors, null, 2), "utf8");

  console.log("AUSTRALIA.json generated successfully");
  console.log(`Total normalized factors: ${factors.length}`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main();