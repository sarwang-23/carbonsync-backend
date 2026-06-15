import { CONFIG } from "../../config/constants.js";
import {type LineItem,type PreprocessedInput } from "../../types/index.js";

/**
 * Deterministic text cleaning pipeline.
 * No LLM involved — pure regex transformations applied in order.
 */
export function preprocess(item: LineItem): PreprocessedInput {
  let text = item.description;

  // 1. Uppercase for pattern matching consistency, then we'll title-case at the end
  text = text.trim();

  // 2. Remove condition/status words (NEW, UNUSED, SEALED, etc.)
  text = text.replace(CONFIG.preprocessor.conditionPattern, "");

  // 3. Remove size indicators before SKU removal to avoid partial matches
  text = text.replace(CONFIG.preprocessor.sizePattern, "");

  // 4. Remove SKU / part-number tokens (mixed alphanumeric codes)
  text = text.replace(CONFIG.preprocessor.skuPattern, "");

  // 5. Remove standalone long numeric sequences
  text = text.replace(CONFIG.preprocessor.longNumericPattern, "");

  // 6. Strip leftover punctuation artifacts (leading/trailing dashes, commas, slashes)
  text = text.replace(/[\-,/|]+\s*$/, "").replace(/^\s*[\-,/|]+/, "");

  // 7. Collapse multiple spaces into one
  text = text.replace(CONFIG.preprocessor.whitespacePattern, " ").trim();

  // 8. Normalize to title case for consistent LLM input
  text = toTitleCase(text);

  return {
    original: item.description,
    cleaned: text,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  };
}

/**
 * Converts a string to Title Case, preserving known acronyms.
 */
function toTitleCase(input: string): string {
  const ACRONYMS = new Set(["USB", "LED", "LCD", "AC", "DC", "HD", "UHD", "TV", "PC"]);

  return input
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}