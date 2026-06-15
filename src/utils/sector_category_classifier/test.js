/**
 * validate-filters.js
 * Validates sectors.json, categories.json and sector_category_mappings.json
 * against a full re-fetch of the paginated Climatiq API.
 *
 * Tests:
 *   TEST 1 — Missing sectors      (API value absent from JSON)
 *   TEST 2 — Missing categories   (API value absent from JSON)
 *   TEST 3 — Mapping correctness  (category not inside mapping[sector])
 *   TEST 4 — Extra values         (JSON value not present anywhere in API)
 *   TEST 5 — Normalization collisions (different raw values → same normalized)
 *   TEST 6 — Count comparison     (unique counts: API vs JSON)
 *
 * Usage:  node test.js
 * Env vars: CLIMATEIQ_URL, CLIMATEIQ_API_KEY
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

const BASE_URL = process.env.CLIMATEIQ_URL    || '';
const API_KEY  = process.env.CLIMATEIQ_API_KEY || '';

const IN_SECTORS    = path.resolve(__dirname, '../../classes/sectors.json');
const IN_CATEGORIES = path.resolve(__dirname, '../../classes/categories.json');
const IN_MAPPINGS   = path.resolve(__dirname, '../../classes/sector_category_mappings.json');

// ── Early validation ──────────────────────────────────────────────────────────
if (!BASE_URL) {
  console.error('✗  CLIMATEIQ_URL is not set. Add it to your .env or set it as an environment variable.');
  process.exit(1);
}

const CONFIG = {
  maxRetries:       2,
  retryDelayMs:     1_000,
  pageDelayMs:      150,
  pageSize:         500,
  requestTimeoutMs: 30_000,
  maxIssuesPerType: 50,    // cap reported issues per test type
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildUrl(page) {
  const url = new URL(BASE_URL);
  url.searchParams.set('allowed_data_quality_flags', 'none');
  url.searchParams.set('page',                       String(page));
  url.searchParams.set('results_per_page',           String(CONFIG.pageSize));
  url.searchParams.set('data_version',               '^32');
  return url.toString();
}

function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;
  return headers;
}

async function fetchPage(page) {
  const url     = buildUrl(page);
  const headers = buildHeaders();
  let lastError;

  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      console.warn(`    ↻ Retry ${attempt}/${CONFIG.maxRetries} for page ${page} …`);
      await sleep(CONFIG.retryDelayMs * attempt);
    }

    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);

      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

      const data = await response.json();
      if (!Array.isArray(data.results)) throw new Error(`Missing 'results' array in response`);

      return data;
    } catch (err) {
      lastError = err;
      console.error(`    ✗ Page ${page}, attempt ${attempt + 1}: ${err.message}`);
    }
  }

  throw new Error(`Failed to fetch page ${page} after ${CONFIG.maxRetries + 1} attempts: ${lastError?.message}`);
}

// ─── Issue collector ──────────────────────────────────────────────────────────

/**
 * Thin wrapper around an array that caps stored entries and counts all pushes.
 */
class IssueList {
  constructor(limit = CONFIG.maxIssuesPerType) {
    this._limit  = limit;
    this._items  = [];
    this.total   = 0;
  }
  push(msg) {
    this.total++;
    if (this._items.length < this._limit) this._items.push(msg);
  }
  get items()     { return this._items; }
  get truncated() { return this.total > this._limit; }
}

// ─── Load class files ─────────────────────────────────────────────────────────

function loadClassFiles() {
  for (const [label, file] of [
    ['sectors',                IN_SECTORS],
    ['categories',             IN_CATEGORIES],
    ['sector_category_mappings', IN_MAPPINGS],
  ]) {
    if (!fs.existsSync(file)) {
      console.error(`✗ Cannot find ${file}. Run extract_filter.js first.`);
      process.exit(1);
    }
  }

  let rawSectors, rawCategories, rawMappings;
  try {
    rawSectors    = JSON.parse(fs.readFileSync(IN_SECTORS,    'utf8'));
    rawCategories = JSON.parse(fs.readFileSync(IN_CATEGORIES, 'utf8'));
    rawMappings   = JSON.parse(fs.readFileSync(IN_MAPPINGS,   'utf8'));
  } catch (err) {
    console.error(`✗ Failed to parse class files: ${err.message}`);
    process.exit(1);
  }

  const jsonSectors    = new Set(rawSectors.sectors       ?? []);
  const jsonCategories = new Set(rawCategories.categories ?? []);

  // mapping: sector → Set<category>
  const jsonMapping = new Map();
  for (const [sector, cats] of Object.entries(rawMappings.mapping ?? {})) {
    jsonMapping.set(sector, new Set(cats));
  }

  return { jsonSectors, jsonCategories, jsonMapping };
}

// ─── Validation ───────────────────────────────────────────────────────────────

async function validate() {
  console.log('═══════════════════════════════════════════');
  console.log(' EF Filter Validator — starting validation');
  console.log('═══════════════════════════════════════════');
  console.log(`  Sectors    → ${IN_SECTORS}`);
  console.log(`  Categories → ${IN_CATEGORIES}`);
  console.log(`  Mappings   → ${IN_MAPPINGS}`);
  console.log(`  Base URL   : ${BASE_URL}`);
  console.log();

  const { jsonSectors, jsonCategories, jsonMapping } = loadClassFiles();

  // ── Tracking structures ────────────────────────────────────────────────────

  /** Unique normalized values actually seen in the API during this pass */
  const apiSectors    = new Set();
  const apiCategories = new Set();

  /**
   * For TEST 5 (normalization collisions):
   * rawToNorm maps  normalized_value → Set of raw strings that produced it.
   * A collision is when Set.size > 1.
   */
  const rawSectorToNorm   = new Map(); // normalized → Set<raw>
  const rawCategoryToNorm = new Map(); // normalized → Set<raw>

  // Issue collectors
  const issues = {
    missingSectors:    new IssueList(),  // TEST 1
    missingCategories: new IssueList(),  // TEST 2
    mappingErrors:     new IssueList(),  // TEST 3
    extraSectors:      new IssueList(),  // TEST 4 (computed post-loop)
    extraCategories:   new IssueList(),  // TEST 4 (computed post-loop)
    normCollisions:    new IssueList(),  // TEST 5 (computed post-loop)
  };

  let totalRecords = 0;
  let currentPage  = 1;
  let lastPage     = null;

  // ── Page loop ──────────────────────────────────────────────────────────────

  while (true) {
    process.stdout.write(`  Fetching page ${currentPage}${lastPage ? `/${lastPage}` : ''} …`);

    let data;
    try {
      data = await fetchPage(currentPage);
    } catch (err) {
      console.error(`\n  ✗ Stopping validation: ${err.message}`);
      process.exit(1);
    }

    if (lastPage === null) {
      lastPage = data.last_page;
      console.log();
      console.log(`  ℹ  Total pages: ${lastPage}, total results: ${data.total_results}`);
      console.log();
      process.stdout.write(`  Fetching page ${currentPage}/${lastPage} …`);
    }

    const results = data.results;
    totalRecords += results.length;

    for (const ef of results) {
      const rawSector   = ef.sector   != null ? String(ef.sector)   : null;
      const rawCategory = ef.category != null ? String(ef.category) : null;

      const sector   = normalize(rawSector);
      const category = normalize(rawCategory);

      // Track normalized values
      if (sector   !== null) apiSectors.add(sector);
      if (category !== null) apiCategories.add(category);

      // Build raw→norm collision maps
      if (sector !== null && rawSector !== null) {
        if (!rawSectorToNorm.has(sector)) rawSectorToNorm.set(sector, new Set());
        rawSectorToNorm.get(sector).add(rawSector);
      }
      if (category !== null && rawCategory !== null) {
        if (!rawCategoryToNorm.has(category)) rawCategoryToNorm.set(category, new Set());
        rawCategoryToNorm.get(category).add(rawCategory);
      }

      // TEST 1: sector present in JSON?
      if (sector !== null && !jsonSectors.has(sector)) {
        issues.missingSectors.push(
          `Sector "${sector}" (page ${currentPage}) is in API but missing from sectors.json`
        );
      }

      // TEST 2: category present in JSON?
      if (category !== null && !jsonCategories.has(category)) {
        issues.missingCategories.push(
          `Category "${category}" (page ${currentPage}) is in API but missing from categories.json`
        );
      }

      // TEST 3: mapping correctness
      if (sector !== null && category !== null) {
        const mappedCats = jsonMapping.get(sector);
        if (!mappedCats || !mappedCats.has(category)) {
          issues.mappingErrors.push(
            `mapping["${sector}"] does not contain "${category}" (page ${currentPage}, id: ${ef.id ?? 'unknown'})`
          );
        }
      }
    }

    console.log(`  ✓  (records: ${results.length}, running total: ${totalRecords})`);

    if (currentPage >= lastPage) {
      console.log();
      console.log(`  ✓  All ${lastPage} pages processed.`);
      break;
    }

    currentPage++;
    if (CONFIG.pageDelayMs > 0) await sleep(CONFIG.pageDelayMs);
  }

  // ── Post-loop tests ────────────────────────────────────────────────────────

  // TEST 4: Extra values in JSON not found in API
  for (const s of jsonSectors) {
    if (!apiSectors.has(s)) {
      issues.extraSectors.push(`Sector "${s}" is in sectors.json but was NOT found in the API`);
    }
  }
  for (const c of jsonCategories) {
    if (!apiCategories.has(c)) {
      issues.extraCategories.push(`Category "${c}" is in categories.json but was NOT found in the API`);
    }
  }

  // TEST 5: Normalization collisions
  for (const [norm, rawSet] of rawSectorToNorm) {
    if (rawSet.size > 1) {
      issues.normCollisions.push(
        `Sector collision → normalized "${norm}" from raw values: [${Array.from(rawSet).map((v) => `"${v}"`).join(', ')}]`
      );
    }
  }
  for (const [norm, rawSet] of rawCategoryToNorm) {
    if (rawSet.size > 1) {
      issues.normCollisions.push(
        `Category collision → normalized "${norm}" from raw values: [${Array.from(rawSet).map((v) => `"${v}"`).join(', ')}]`
      );
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────

  const totalIssues =
    issues.missingSectors.total +
    issues.missingCategories.total +
    issues.mappingErrors.total +
    issues.extraSectors.total +
    issues.extraCategories.total +
    issues.normCollisions.total;

  const sectorCountMatch   = apiSectors.size    === jsonSectors.size;
  const categoryCountMatch = apiCategories.size === jsonCategories.size;

  console.log();
  console.log('═══════════════════════════════════════════');
  console.log(' Validation Report');
  console.log('═══════════════════════════════════════════');
  console.log();
  console.log('  ── Summary ─────────────────────────────');
  console.log(`  Total records processed : ${totalRecords}`);
  console.log();
  console.log('  ── TEST 6: Count Comparison ────────────');
  console.log(`  Unique sectors    — API: ${apiSectors.size}   JSON: ${jsonSectors.size}   ${sectorCountMatch   ? '✓ MATCH' : '✗ MISMATCH'}`);
  console.log(`  Unique categories — API: ${apiCategories.size}  JSON: ${jsonCategories.size}  ${categoryCountMatch ? '✓ MATCH' : '✗ MISMATCH'}`);
  console.log();
  console.log(`  Total issues found      : ${totalIssues}`);
  console.log();

  printTestBlock('TEST 1 — Missing Sectors',    issues.missingSectors);
  printTestBlock('TEST 2 — Missing Categories', issues.missingCategories);
  printTestBlock('TEST 3 — Mapping Errors',     issues.mappingErrors);
  printTestBlock('TEST 4 — Extra Sectors (in JSON, absent from API)',     issues.extraSectors);
  printTestBlock('TEST 4 — Extra Categories (in JSON, absent from API)', issues.extraCategories);
  printTestBlock('TEST 5 — Normalization Collisions', issues.normCollisions);

  console.log('═══════════════════════════════════════════');
  if (totalIssues === 0) {
    console.log(' ✅  All tests PASSED — class files are valid.');
  } else {
    console.log(` ❌  Validation FAILED — ${totalIssues} issue(s) found.`);
  }
  console.log('═══════════════════════════════════════════');

  // Exit with non-zero code if there are issues (useful in CI pipelines)
  process.exit(totalIssues === 0 ? 0 : 1);
}

/**
 * Pretty-print a labelled block of issues.
 * @param {string}    label
 * @param {IssueList} list
 */
function printTestBlock(label, list) {
  const symbol = list.total === 0 ? '✓' : '✗';
  console.log(`  ── ${symbol} ${label}`);
  if (list.total === 0) {
    console.log('       No issues.\n');
    return;
  }
  for (const item of list.items) {
    console.log(`       • ${item}`);
  }
  if (list.truncated) {
    console.log(`       … and ${list.total - CONFIG.maxIssuesPerType} more (truncated)`);
  }
  console.log(`       Total: ${list.total}\n`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

validate().catch((err) => {
  console.error('Fatal error during validation:', err);
  process.exit(1);
});