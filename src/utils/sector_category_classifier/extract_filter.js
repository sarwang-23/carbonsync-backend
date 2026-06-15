/**
 * extract-filters.js
 * Extracts unique sector/category filter values from a paginated EF API
 * and saves them to filters.json.
 *
 * Usage:  node extract-filters.js [BASE_URL] [API_KEY]
 * Defaults to the environment variables EF_API_BASE_URL and EF_API_KEY.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load .env from project root (two levels up from this file)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL    = process.env.CLIMATEIQ_URL || '';
const API_KEY     = process.env.CLIMATEIQ_API_KEY || '';
const OUT_SECTORS    = path.resolve(__dirname, '../../classes/sectors.json');
const OUT_CATEGORIES = path.resolve(__dirname, '../../classes/categories.json');
const OUT_MAPPINGS   = path.resolve(__dirname, '../../classes/sector_category_mappings.json');

// ── Early validation ──────────────────────────────────────────────────────────
if (!BASE_URL) {
  console.error('✗  CLIMATEIQ_URL is not set. Add it to your .env or set it as an environment variable.');
  process.exit(1);
}

const CONFIG = {
  maxRetries:      2,
  retryDelayMs:    1_000,   // delay between retries
  pageDelayMs:     150,     // polite delay between pages
  pageSize:        500,     // results per page (adjust to API max)
  requestTimeoutMs: 30_000,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sleep for `ms` milliseconds.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalize a raw string value: trim whitespace only.
 * Values are stored exactly as returned (after trim).
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
function normalize(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Build the URL for a given page number.
 * @param {number} page
 * @returns {string}
 */
function buildUrl(page) {
  const url = new URL(BASE_URL);
  url.searchParams.set('allowed_data_quality_flags', 'none');
  url.searchParams.set('page',                       String(page));
  url.searchParams.set('results_per_page',           String(CONFIG.pageSize));
  url.searchParams.set('data_version',               '^32');
  console.log(url.toString());
  return url.toString();
}

/**
 * Build request headers.
 * @returns {Record<string,string>}
 */
function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;
  return headers;
}

/**
 * Fetch a single page with retry logic.
 * @param {number} page
 * @returns {Promise<{current_page:number, last_page:number, total_results:number, results:any[]}>}
 */
async function fetchPage(page) {
  const url     = buildUrl(page);
  const headers = buildHeaders();

  let lastError;

  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      console.warn(`  ↻  Retry ${attempt}/${CONFIG.maxRetries} for page ${page} …`);
      await sleep(CONFIG.retryDelayMs * attempt); // exponential back-off
    }

    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);

      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Basic shape validation
      if (!Array.isArray(data.results)) {
        throw new Error(`Unexpected response shape: missing 'results' array`);
      }

      return data;
    } catch (err) {
      lastError = err;
      console.error(`  ✗  Page ${page}, attempt ${attempt + 1} failed: ${err.message}`);
    }
  }

  // All retries exhausted
  throw new Error(`Failed to fetch page ${page} after ${CONFIG.maxRetries + 1} attempts: ${lastError?.message}`);
}

// ─── Extraction ───────────────────────────────────────────────────────────────

/**
 * Main extraction routine.
 * Iterates all pages, extracts unique sectors/categories and their mapping,
 * then writes filters.json.
 */
async function extract() {
  console.log('═══════════════════════════════════════════');
  console.log(' EF Filter Extractor — starting extraction');
  console.log('═══════════════════════════════════════════');
  console.log(`  Sectors    → ${OUT_SECTORS}`);
  console.log(`  Categories → ${OUT_CATEGORIES}`);
  console.log(`  Mappings   → ${OUT_MAPPINGS}`);
  console.log(`  Base URL   : ${BASE_URL}`);
  console.log();

  /** @type {Set<string>}            All unique, normalized sectors     */
  const sectors = new Set();

  /** @type {Set<string>}            All unique, normalized categories  */
  const categories = new Set();

  /** @type {Map<string, Set<string>>} sector → Set of categories       */
  const mapping = new Map();

  let totalRecords  = 0;
  let currentPage   = 1;
  let lastPage      = null; // determined from first response

  while (true) {
    process.stdout.write(`  Fetching page ${currentPage}${lastPage ? `/${lastPage}` : ''} …`);

    let data;
    try {
      data = await fetchPage(currentPage);
    } catch (err) {
      console.error(`\n  ✗  Stopping extraction: ${err.message}`);
      process.exit(1);
    }

    // Set last_page from the first response (or refresh each time for safety)
    if (lastPage === null) {
      lastPage = data.last_page;
      console.log();
      console.log(`  ℹ  Total pages: ${lastPage}, total results: ${data.total_results}`);
      console.log();
      process.stdout.write(`  Fetching page ${currentPage}/${lastPage} …`);
    }

    const results = data.results;
    totalRecords += results.length;

    // ── Process each record without holding them all in memory ──
    for (const ef of results) {
      const sector   = normalize(ef.sector);
      const category = normalize(ef.category);

      if (sector !== null) {
        sectors.add(sector);
      }

      if (category !== null) {
        categories.add(category);
      }

      // Build sector → [categories] mapping
      if (sector !== null && category !== null) {
        if (!mapping.has(sector)) {
          mapping.set(sector, new Set());
        }
        mapping.get(sector).add(category);
      }
    }

    console.log(`  ✓  (records this page: ${results.length}, running total: ${totalRecords})`);

    // ── Stop condition ──
    if (currentPage >= lastPage) {
      console.log();
      console.log(`  ✓  All ${lastPage} pages fetched.`);
      break;
    }

    currentPage++;

    // Polite delay between pages
    if (CONFIG.pageDelayMs > 0) {
      await sleep(CONFIG.pageDelayMs);
    }
  }

  // ── Serialize ──────────────────────────────────────────────────────────────

  const extractedAt = new Date().toISOString();

  // sectors.json
  const sectorsOutput = {
    extracted_at:  extractedAt,
    total_records: totalRecords,
    sectors:       Array.from(sectors).sort(),
  };

  // categories.json
  const categoriesOutput = {
    extracted_at:  extractedAt,
    total_records: totalRecords,
    categories:    Array.from(categories).sort(),
  };

  // sector_category_mappings.json
  const mappingObject = {};
  for (const [sector, catSet] of mapping) {
    mappingObject[sector] = Array.from(catSet).sort();
  }
  const mappingsOutput = {
    extracted_at:  extractedAt,
    total_records: totalRecords,
    mapping:       mappingObject,
  };

  // Ensure output directories exist
  fs.mkdirSync(path.dirname(OUT_SECTORS),    { recursive: true });
  fs.mkdirSync(path.dirname(OUT_CATEGORIES), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_MAPPINGS),   { recursive: true });

  fs.writeFileSync(OUT_SECTORS,    JSON.stringify(sectorsOutput,    null, 2), 'utf8');
  fs.writeFileSync(OUT_CATEGORIES, JSON.stringify(categoriesOutput, null, 2), 'utf8');
  fs.writeFileSync(OUT_MAPPINGS,   JSON.stringify(mappingsOutput,   null, 2), 'utf8');

  console.log();
  console.log('═══════════════════════════════════════════');
  console.log(' Extraction complete');
  console.log('═══════════════════════════════════════════');
  console.log(`  Unique sectors    : ${sectors.size}`);
  console.log(`  Unique categories : ${categories.size}`);
  console.log(`  Total records     : ${totalRecords}`);
  console.log(`  → ${OUT_SECTORS}`);
  console.log(`  → ${OUT_CATEGORIES}`);
  console.log(`  → ${OUT_MAPPINGS}`);
  console.log('═══════════════════════════════════════════');
}

// ─── Entry point ──────────────────────────────────────────────────────────────

extract().catch((err) => {
  console.error('Fatal error during extraction:', err);
  process.exit(1);
});