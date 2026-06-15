/**
 * Test suite for the upgraded EF classification pipeline.
 * Run: npx tsx src/tests/pipeline.test.ts
 */
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { ClassificationPipeline } from "../pipeline/orchestrator.js";
import { InMemoryCacheService } from "../services/cache.service.js";
import { MockLLMService } from "../services/llm.service.js";
import { loadTaxonomy, resetTaxonomyCache } from "../taxonomy/loader.js";
import type {
  EFOutput,
  ILLMService,
  LineItem,
  LLMRequest,
  LLMResponse,
  TaxonomyStore,
} from "../types/index.js";
import { preprocess } from "../utils/normalization/cleaner.js";
import { validateTaxonomy } from "../validators/taxonomy.validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): void {
  Promise.resolve()
    .then(() => fn())
    .then(() => { console.log(`  ✅  ${name}`); passed++; })
    .catch((err: unknown) => {
      console.error(`  ❌  ${name}`);
      console.error(`      ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion: ${message}`);
}

const DATA_DIR = join(__dirname, "..", "..", "data");

// ─── Taxonomy Loader Tests ────────────────────────────────────────────────────

console.log("\n── Taxonomy Loader ──");

test("loads all taxonomy files without error", () => {
  resetTaxonomyCache();
  const taxonomy = loadTaxonomy(DATA_DIR);
  assert(taxonomy.sectors.size > 0, "sectors loaded");
  assert(taxonomy.categories.size > 0, "categories loaded");
  assert(taxonomy.unitTypes.size > 0, "unit types loaded");
  assert(taxonomy.sectorCategoryMap.size > 0, "mappings loaded");
});

test("sectors match known values", () => {
  const taxonomy = loadTaxonomy(DATA_DIR);
  assert(taxonomy.sectors.has("Energy"), "Energy sector present");
  assert(taxonomy.sectors.has("Transport"), "Transport sector present");
  assert(taxonomy.sectors.has("Equipment"), "Equipment sector present");
});

test("categories are indexed correctly", () => {
  const taxonomy = loadTaxonomy(DATA_DIR);
  assert(taxonomy.categories.has("Electronics"), "Electronics category present");
  assert(taxonomy.categories.has("Fuel"), "Fuel category present");
});

test("unit types include expected values", () => {
  const taxonomy = loadTaxonomy(DATA_DIR);
  assert(taxonomy.unitTypes.has("Weight"), "Weight unit type present");
  assert(taxonomy.unitTypes.has("Energy"), "Energy unit type present");
  assert(taxonomy.unitTypes.has("Number"), "Number unit type present");
  assert(taxonomy.unitTypes.has("Money"), "Money unit type present");
});

test("sector-category mapping is correct", () => {
  const taxonomy = loadTaxonomy(DATA_DIR);
  const energyCats = taxonomy.sectorCategoryMap.get("Energy");
  assert(energyCats !== undefined, "Energy sector has mapping");
  assert(energyCats!.has("Electricity"), "Electricity belongs to Energy");
  assert(energyCats!.has("Fuel"), "Fuel belongs to Energy");
});

// ─── Taxonomy Validator Tests ─────────────────────────────────────────────────

console.log("\n── Taxonomy Validator ──");

let taxonomy: TaxonomyStore;
try {
  taxonomy = loadTaxonomy(DATA_DIR);
} catch {
  console.error("Could not load taxonomy — skipping validator tests");
  process.exit(1);
}

const validLLMOutput = {
  clean_product_name: "Industrial Diesel Generator",
  brand: "Caterpillar",
  product_type: "Power Generation",
  subtype: "Diesel",
  keywords: ["generator", "diesel", "industrial", "power"],
  use_case: "Backup power generation",
  material: "Steel",
  confidence: 0.9,
  sector: "Equipment",
  category: "Machinery",
  unit_type: "Energy",
  reasoning: "Industrial generator classified under Equipment sector, Machinery category.",
};

test("accepts a fully valid LLM output", () => {
  const result = validateTaxonomy(validLLMOutput, taxonomy);
  assert(result.valid, `Should be valid, errors: ${result.errors.join("; ")}`);
  assert(result.data !== undefined, "data should be set");
});

test("rejects invalid sector", () => {
  const result = validateTaxonomy({ ...validLLMOutput, sector: "FakeSector" }, taxonomy);
  assert(!result.valid, "should be invalid");
  assert(result.errors.some((e) => e.includes("sector")), "sector error present");
});

test("rejects invalid category", () => {
  const result = validateTaxonomy({ ...validLLMOutput, category: "MadeUpCategory" }, taxonomy);
  assert(!result.valid, "should be invalid");
  assert(result.errors.some((e) => e.includes("category")), "category error present");
});

test("rejects invalid unit_type", () => {
  const result = validateTaxonomy({ ...validLLMOutput, unit_type: "Bananas" }, taxonomy);
  assert(!result.valid, "should be invalid");
  assert(result.errors.some((e) => e.includes("unit_type")), "unit_type error present");
});

test("rejects sector-category mismatch", () => {
  // Electricity belongs to Energy, not Equipment
  const result = validateTaxonomy(
    { ...validLLMOutput, sector: "Equipment", category: "Electricity" },
    taxonomy
  );
  assert(!result.valid, "should be invalid");
  assert(result.errors.some((e) => e.includes("not valid for")), "mapping error present");
});

test("rejects empty reasoning", () => {
  const result = validateTaxonomy({ ...validLLMOutput, reasoning: "" }, taxonomy);
  assert(!result.valid, "should be invalid");
  assert(result.errors.some((e) => e.includes("reasoning")), "reasoning error");
});

test("rejects empty keywords", () => {
  const result = validateTaxonomy({ ...validLLMOutput, keywords: [] }, taxonomy);
  assert(!result.valid, "should be invalid");
});

test("rejects confidence out of range", () => {
  const result = validateTaxonomy({ ...validLLMOutput, confidence: 1.5 }, taxonomy);
  assert(!result.valid, "should be invalid");
});

test("collects all errors in one pass", () => {
  const result = validateTaxonomy(
    { ...validLLMOutput, sector: "Bad", category: "Bad", unit_type: "Bad", reasoning: "" },
    taxonomy
  );
  assert(!result.valid, "should be invalid");
  assert(result.errors.length >= 3, `Should have ≥3 errors, got ${result.errors.length}`);
});

// ─── Preprocessor Tests ───────────────────────────────────────────────────────

console.log("\n── Preprocessor ──");

test("removes SKU codes", () => {
  const r = preprocess({ description: "Nike AIR-MAX90 Running Shoe", quantity: 1, unitPrice: 90 });
  assert(!r.cleaned.includes("AIR-MAX90"), "SKU removed");
});

test("removes condition words", () => {
  const r = preprocess({ description: "NEW SEALED Diesel Generator 50kw", quantity: 1, unitPrice: 5000 });
  assert(!r.cleaned.match(/\bNEW\b/i), "NEW removed");
  assert(!r.cleaned.match(/\bSEALED\b/i), "SEALED removed");
});

test("preserves original description", () => {
  const item: LineItem = { description: "Test Product XL", quantity: 2, unitPrice: 10 };
  const r = preprocess(item);
  assert(r.original === item.description, "original intact");
});

// ─── Cache Tests ──────────────────────────────────────────────────────────────

console.log("\n── Cache ──");

const sampleEF: EFOutput = {
  raw_description: "Diesel fuel 100L",
  normalized_output: {
    clean_product_name: "Diesel Fuel",
    brand: null, product_type: "Fuel", subtype: "Diesel",
    keywords: ["diesel", "fuel"], use_case: "Transport", material: null, confidence: 0.95,
  },
  final_validated_classification: { sector: "Energy", category: "Fuel", unit_type: "Volume" },
  reasoning: "Diesel fuel for transport.",
};

test("stores and retrieves EFOutput", async () => {
  const cache = new InMemoryCacheService(60_000);
  await cache.set("key1", sampleEF);
  const r = await cache.get("key1");
  assert(r?.final_validated_classification.sector === "Energy", "sector preserved");
  assert(r?.final_validated_classification.unit_type === "Volume", "unit_type preserved");
});

test("expires entries after TTL", async () => {
  const cache = new InMemoryCacheService(10);
  await cache.set("key2", sampleEF);
  await new Promise((r) => setTimeout(r, 20));
  assert((await cache.get("key2")) === null, "expired entry returns null");
});

// ─── Full Pipeline Tests ──────────────────────────────────────────────────────

console.log("\n── Pipeline (end-to-end with MockLLM) ──");

function makeMockLLM(overrides?: Partial<typeof validLLMOutput>): MockLLMService {
  return new MockLLMService(() => ({ ...validLLMOutput, ...overrides }));
}

function makePipeline(llm: ILLMService): ClassificationPipeline {
  return new ClassificationPipeline(llm, new InMemoryCacheService(60_000), taxonomy);
}

test("successful end-to-end classification", async () => {
  const pipeline = makePipeline(makeMockLLM());
  const result = await pipeline.normalizeLineItem({
    description: "NEW Industrial Diesel Generator CAT-D5000 50kW",
    quantity: 1,
    unitPrice: 15000,
  });
  assert(result.success, `should succeed, error: ${result.error}`);
  assert(result.data?.final_validated_classification.sector === "Equipment", "correct sector");
  assert(result.data?.final_validated_classification.category === "Machinery", "correct category");
  assert(result.data?.final_validated_classification.unit_type === "Energy", "correct unit_type");
  assert(typeof result.data?.reasoning === "string", "reasoning present");
  assert(result.fromCache === false, "not from cache");
});

test("EFOutput contains raw_description", async () => {
  const pipeline = makePipeline(makeMockLLM());
  const input: LineItem = { description: "SEALED Office Desk Chair", quantity: 2, unitPrice: 250 };
  const result = await pipeline.normalizeLineItem(input);
  assert(result.data?.raw_description === input.description, "raw_description preserved");
});

test("second call returns from cache", async () => {
  const pipeline = makePipeline(makeMockLLM());
  const input: LineItem = { description: "Diesel Generator 50kW", quantity: 1, unitPrice: 5000 };
  await pipeline.normalizeLineItem(input);
  const second = await pipeline.normalizeLineItem(input);
  assert(second.fromCache === true, "second call from cache");
  assert(second.attempts === 0, "zero LLM calls on cache hit");
});

test("retries when LLM returns bad taxonomy values", async () => {
  let call = 0;
  const flakyLLM: ILLMService = {
    async complete(_req: LLMRequest): Promise<LLMResponse> {
      call++;
      const data = call === 1
        ? { ...validLLMOutput, sector: "InvalidSector" }   // Bad on attempt 1
        : { ...validLLMOutput };                            // Good on attempt 2
      return { raw: JSON.stringify(data), parsed: data };
    },
  };
  const pipeline = makePipeline(flakyLLM);
  const result = await pipeline.normalizeLineItem({ description: "Test item", quantity: 1, unitPrice: 10 });
  assert(result.success, "should succeed after retry");
  assert((result.attempts ?? 0) === 2, "should use 2 attempts");
});

test("fails gracefully after max retries with sector-category mismatch", async () => {
  // Always returns a sector-category mismatch
  const badLLM: ILLMService = {
    async complete(_req: LLMRequest): Promise<LLMResponse> {
      const data = { ...validLLMOutput, sector: "Energy", category: "Machinery" }; // Mismatch
      return { raw: JSON.stringify(data), parsed: data };
    },
  };
  const pipeline = new ClassificationPipeline(badLLM, new InMemoryCacheService(60_000), taxonomy, { maxRetries: 2 });
  const result = await pipeline.normalizeLineItem({ description: "Bad item", quantity: 1, unitPrice: 1 });
  assert(!result.success, "should fail");
  assert(typeof result.error === "string", "error message present");
  assert((result.attempts ?? 0) === 3, "3 total attempts");
});

test("fails gracefully on JSON parse failure", async () => {
  const badLLM: ILLMService = {
    async complete(_req: LLMRequest): Promise<LLMResponse> {
      return { raw: "This is definitely not JSON", parsed: null };
    },
  };
  const pipeline = new ClassificationPipeline(badLLM, new InMemoryCacheService(60_000), taxonomy, { maxRetries: 0 });
  const result = await pipeline.normalizeLineItem({ description: "Test", quantity: 1, unitPrice: 1 });
  assert(!result.success, "should fail on unparseable output");
});

// ─── Summary ──────────────────────────────────────────────────────────────────

setTimeout(() => {
  console.log(`\n${"─".repeat(44)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}, 300);