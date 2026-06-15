/**
 * Example usage of the EF Classification Pipeline.
 *
 * Requires ANTHROPIC_API_KEY for real LLM calls.
 * Swap MockLLMService for the real one when ready.
 *
 * Run: ANTHROPIC_API_KEY=sk-... npx ts-node src/example.ts
 */

import { ClassificationPipeline } from "./pipeline/orchestrator.js";
import { InMemoryCacheService } from "./services/cache.service.js";
import { MockLLMService } from "./services/llm.service.js";
import { getTaxonomy } from "./taxonomy/loader.js";
import type { LineItem } from "./types/index.js";
import { join } from "path";

const SAMPLE_ITEMS: LineItem[] = [
  { description: "NEW UNUSED Nike AIR-MAX90 Running Shoe XL Men", quantity: 2, unitPrice: 109.99 },
  { description: "Apple iPhone 14 Pro 256GB Space Black SEALED", quantity: 1, unitPrice: 999.0 },
  { description: "Diesel Fuel 100L Industrial Generator", quantity: 5, unitPrice: 120.0 },
  { description: "Office Printer Paper A4 80gsm 500 Sheets", quantity: 10, unitPrice: 8.5 },
  // Duplicate — should hit cache
  { description: "NEW UNUSED Nike AIR-MAX90 Running Shoe XL Men", quantity: 1, unitPrice: 109.99 },
];

async function main(): Promise<void> {
  const taxonomy = getTaxonomy(join(__dirname, "..", "data"));

  const pipeline = new ClassificationPipeline(
    new MockLLMService(), // Replace with undefined to use real Anthropic API
    new InMemoryCacheService(3_600_000),
    taxonomy
  );

  console.log("EF Classification Pipeline\n" + "=".repeat(50));

  for (const [i, item] of SAMPLE_ITEMS.entries()) {
    console.log(`\n[Item ${i + 1}] "${item.description}"`);

    const result = await pipeline.normalizeLineItem(item);

    if (result.success && result.data) {
      const { data } = result;
      const cls = data.final_validated_classification;
      console.log(`  Status : ✅ ${result.fromCache ? "CACHE HIT" : `attempt ${result.attempts}`}`);
      console.log(`  Product: ${data.normalized_output.clean_product_name}`);
      console.log(`  Sector : ${cls.sector}`);
      console.log(`  Category: ${cls.category}`);
      console.log(`  Unit   : ${cls.unit_type}`);
      console.log(`  Confidence: ${data.normalized_output.confidence.toFixed(2)}`);
      console.log(`  Reasoning: ${data.reasoning}`);
    } else {
      console.log(`  Status : ❌ ${result.error}`);
    }
  }
}

main().catch(console.error);