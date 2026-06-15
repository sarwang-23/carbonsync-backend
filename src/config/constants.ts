import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Centralized configuration for the Environmental Footprint (EF) Classification Pipeline
export const CONFIG = {
  // LLM service settings for deterministic product classification
  llm: {
    model: "claude-sonnet-4-20250514",
    maxTokens: 1500,
    temperature: 0,
    maxRetries: 2,
  },

  // Cache settings (1 hour TTL) for normalized product descriptions
  cache: {
    ttlMs: 60 * 60 * 1000,
  },

  // Path to taxonomy reference data
  taxonomy: {
    dataDir: join(__dirname, "..", "..", "data"),
  },

  // Regex patterns to clean product descriptions before classification
  preprocessor: {
    skuPattern: /\b[A-Z0-9]{2,}-?[A-Z0-9]{3,}\b/g,
    longNumericPattern: /\b\d{3,}\b/g,
    sizePattern: /\b(XXS|XS|SM?|M[LD]?|LG?|XL|XXL|[2-9]XL|\d+Y|\d+T|size\s*\d+|sz\.?\s*\d+)\b/gi,
    conditionPattern: /\b(new|unused|refurbished|used|open[\s-]?box|like[\s-]?new|sealed|oem|nib|nos)\b/gi,
    whitespacePattern: /\s{2,}/g,
  },
} as const;