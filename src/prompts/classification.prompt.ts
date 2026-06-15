import type { TaxonomyStore } from "../types/index.js";

// ─── System Prompt ────────────────────────────────────────────────────────────

export const CLASSIFICATION_SYSTEM_PROMPT = `You are a product classification engine for an Environmental Footprint (EF) data pipeline.
Your sole task is to analyze product descriptions and return a single, valid JSON object.
You must NEVER respond with prose, markdown, code fences, or explanations.
You must NEVER invent values — every classification field must come exactly from the provided lists.
You must use temperature=0 reasoning: deterministic, factual, constrained.`;

// ─── Primary extraction + classification prompt ───────────────────────────────

export function buildClassificationPrompt(
  cleanedDescription: string,
  taxonomy: TaxonomyStore
): string {
  const sectors = [...taxonomy.sectors].sort().join("\n  - ");
  const categories = [...taxonomy.categories].sort().join("\n  - ");
  const unitTypes = [...taxonomy.unitTypes].sort().join("\n  - ");

  // Build sector→category mapping section so the LLM understands constraints
  const mappingLines = [...taxonomy.sectorCategoryMap.entries()]
    .map(([sector, cats]) => `  "${sector}": [${[...cats].map((c) => `"${c}"`).join(", ")}]`)
    .join("\n");

  return `Analyze this product description and return ONLY a JSON object with ALL fields listed below.

PRODUCT DESCRIPTION:
"${cleanedDescription}"

─── REQUIRED JSON STRUCTURE ───────────────────────────────────────────────────
{
  "clean_product_name": "<concise, human-readable product name>",
  "brand": "<brand name or null>",
  "product_type": "<primary product category or null>",
  "subtype": "<specific variant/sub-category or null>",
  "keywords": ["<keyword1>", "<keyword2>", "..."],
  "use_case": "<primary intended use or null>",
  "material": "<primary material or null>",
  "confidence": <float 0.0–1.0>,
  "sector": "<MUST be one of the VALID SECTORS below>",
  "category": "<MUST be one of the VALID CATEGORIES below AND must belong to chosen sector>",
  "unit_type": "<MUST be one of the VALID UNIT TYPES below>",
  "reasoning": "<1-2 sentence explanation of why you chose this sector, category, and unit_type>"
}

─── VALID SECTORS (choose exactly one) ────────────────────────────────────────
  - ${sectors}

─── VALID CATEGORIES (choose exactly one) ─────────────────────────────────────
  - ${categories}

─── SECTOR → CATEGORY CONSTRAINTS (category MUST belong to the chosen sector) ─
${mappingLines}

─── VALID UNIT TYPES (choose exactly one) ─────────────────────────────────────
  - ${unitTypes}

─── RULES ─────────────────────────────────────────────────────────────────────
1. sector must be copied EXACTLY (case-sensitive) from the VALID SECTORS list
2. category must be copied EXACTLY (case-sensitive) from the VALID CATEGORIES list
3. category must belong to the chosen sector per the SECTOR → CATEGORY CONSTRAINTS
4. unit_type must be copied EXACTLY (case-sensitive) from the VALID UNIT TYPES list
5. keywords must be a non-empty array of strings
6. confidence must be a number between 0.0 and 1.0
7. reasoning must explain your sector + category + unit_type choice
8. Return ONLY the JSON object — no other text`;
}

// ─── Correction / retry prompt ────────────────────────────────────────────────

export function buildCorrectionPrompt(
  cleanedDescription: string,
  previousOutput: string,
  validationErrors: string[],
  taxonomy: TaxonomyStore
): string {
  const sectors = [...taxonomy.sectors].sort().join(", ");
  const categories = [...taxonomy.categories].sort().join(", ");
  const unitTypes = [...taxonomy.unitTypes].sort().join(", ");

  return `Your previous response failed validation. Correct it and return ONLY valid JSON.

PRODUCT DESCRIPTION:
"${cleanedDescription}"

YOUR PREVIOUS (INVALID) OUTPUT:
${previousOutput}

VALIDATION ERRORS TO FIX:
${validationErrors.map((e) => `  • ${e}`).join("\n")}

─── REMINDER: VALID VALUES ────────────────────────────────────────────────────
VALID SECTORS: ${sectors}
VALID CATEGORIES: ${categories}
VALID UNIT TYPES: ${unitTypes}

Return the corrected JSON object only — no prose, no markdown fences.`;
}
