import type { TaxonomyStore, TaxonomyValidationResult } from "../types/index.js";

/**
 * Validates a raw LLM output object against the loaded taxonomy.
 * This is the authoritative source of truth — LLM output is never blindly trusted.
 *
 * Returns all validation errors found in a single pass so the correction prompt
 * can address them all at once.
 */
export function validateTaxonomy(
  raw: unknown,
  taxonomy: TaxonomyStore
): TaxonomyValidationResult {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, errors: ["Root value must be a non-null object"] };
  }

  const obj = raw as Record<string, unknown>;

  // ── Normalization fields ──────────────────────────────────────────────────

  if (typeof obj.clean_product_name !== "string" || obj.clean_product_name.trim() === "") {
    errors.push("`clean_product_name` must be a non-empty string");
  }

  for (const field of ["brand", "product_type", "subtype", "use_case", "material"] as const) {
    if (obj[field] !== null && typeof obj[field] !== "string") {
      errors.push(`\`${field}\` must be a string or null`);
    }
  }

  if (!Array.isArray(obj.keywords)) {
    errors.push("`keywords` must be an array");
  } else if (obj.keywords.length === 0) {
    errors.push("`keywords` must be a non-empty array");
  } else if ((obj.keywords as unknown[]).some((k) => typeof k !== "string")) {
    errors.push("`keywords` must contain only strings");
  }

  if (typeof obj.confidence !== "number") {
    errors.push("`confidence` must be a number");
  } else if (obj.confidence < 0 || obj.confidence > 1) {
    errors.push("`confidence` must be between 0 and 1");
  }

  // ── Reasoning ────────────────────────────────────────────────────────────

  if (typeof obj.reasoning !== "string" || obj.reasoning.trim() === "") {
    errors.push("`reasoning` must be a non-empty string");
  }

  // ── Taxonomy-constrained fields ───────────────────────────────────────────

  const sector = obj.sector as string | undefined;
  const category = obj.category as string | undefined;
  const unitType = obj.unit_type as string | undefined;

  if (typeof sector !== "string" || sector.trim() === "") {
    errors.push("`sector` must be a non-empty string");
  } else if (!taxonomy.sectors.has(sector)) {
    errors.push(
      `\`sector\` value "${sector}" is not in the allowed sectors list. Valid sectors: ${[...taxonomy.sectors].join(", ")}`
    );
  }

  if (typeof category !== "string" || category.trim() === "") {
    errors.push("`category` must be a non-empty string");
  } else if (!taxonomy.categories.has(category)) {
    errors.push(
      `\`category\` value "${category}" is not in the allowed categories list`
    );
  }

  if (typeof unitType !== "string" || unitType.trim() === "") {
    errors.push("`unit_type` must be a non-empty string");
  } else if (!taxonomy.unitTypes.has(unitType)) {
    errors.push(
      `\`unit_type\` value "${unitType}" is not in the allowed unit types list. Valid unit_types: ${[...taxonomy.unitTypes].join(", ")}`
    );
  }

  // ── Sector ↔ Category mapping validation ─────────────────────────────────
  // Only runs if both sector and category individually passed their checks.

  if (
    typeof sector === "string" &&
    typeof category === "string" &&
    taxonomy.sectors.has(sector) &&
    taxonomy.categories.has(category)
  ) {
    const allowedCategories = taxonomy.sectorCategoryMap.get(sector);
    if (!allowedCategories || !allowedCategories.has(category)) {
      const allowed = allowedCategories ? [...allowedCategories].join(", ") : "none";
      errors.push(
        `\`category\` "${category}" is not valid for \`sector\` "${sector}". ` +
          `Allowed categories for this sector: ${allowed}`
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // ── Safe cast — all fields validated ─────────────────────────────────────

  return {
    valid: true,
    errors: [],
    data: {
      clean_product_name: (obj.clean_product_name as string).trim(),
      brand: normalizeNullable(obj.brand),
      product_type: normalizeNullable(obj.product_type),
      subtype: normalizeNullable(obj.subtype),
      keywords: (obj.keywords as string[]).map((k) => k.trim()).filter(Boolean),
      use_case: normalizeNullable(obj.use_case),
      material: normalizeNullable(obj.material),
      confidence: obj.confidence as number,
      sector: (obj.sector as string).trim(),
      category: (obj.category as string).trim(),
      unit_type: (obj.unit_type as string).trim(),
      reasoning: (obj.reasoning as string).trim(),
    },
  };
}

function normalizeNullable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" || s.toLowerCase() === "null" ? null : s;
}
