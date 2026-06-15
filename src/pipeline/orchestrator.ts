import { CONFIG } from "../config/constants.js";
import { RetryExhaustedError, LLMCallError } from "../errors/index.js";
import {
  buildClassificationPrompt,
  buildCorrectionPrompt,
  CLASSIFICATION_SYSTEM_PROMPT,
} from "../prompts/classification.prompt.js";
import { InMemoryCacheService, buildCacheKey } from "../services/cache.service.js";
import { AnthropicLLMService } from "../services/llm.service.js";
import { getTaxonomy } from "../taxonomy/loader.js";
import type {
  EFOutput,
  ICacheService,
  ILLMService,
  LineItem,
  PipelineResult,
  RawLLMOutput,
  TaxonomyStore,
} from "../types/index.js";
import { PipelineErrorCode } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { validateTaxonomy } from "../validators/taxonomy.validator.js";
import { preprocess } from "../utils/normalization/cleaner.js";

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class ClassificationPipeline {
  private readonly llm: ILLMService;
  private readonly cache: ICacheService;
  private readonly taxonomy: TaxonomyStore;

  constructor(
    llmService?: ILLMService,
    cacheService?: ICacheService,
    taxonomyStore?: TaxonomyStore,
    private readonly options: { maxRetries: number } = { maxRetries: CONFIG.llm.maxRetries }
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
    this.llm = llmService ?? new AnthropicLLMService(apiKey);
    this.cache = cacheService ?? new InMemoryCacheService(CONFIG.cache.ttlMs);
    this.taxonomy = taxonomyStore ?? getTaxonomy(CONFIG.taxonomy.dataDir);
  }

  /**
   * Main entry point.
   *
   * Flow:
   *   1. preprocess description
   *   2. build cache key from cleaned description
   *   3. check cache (keyed on cleaned description)
   *   4. build constrained LLM prompt
   *   5. call LLM
   *   6. validate taxonomy constraints
   *   7. retry with correction prompt if invalid
   *   8. store final EF output in cache
   *   9. return EF-compatible JSON
   */
  async normalizeLineItem(input: LineItem): Promise<PipelineResult> {
    // ── Step 1: Preprocess ───────────────────────────────────────────────────
    const preprocessed = preprocess(input);
    logger.info("preprocessor", "Preprocessed description", {
      original: input.description,
      cleaned: preprocessed.cleaned,
    });

    // ── Step 2: Build cache key ──────────────────────────────────────────────
    const cacheKey = buildCacheKey(preprocessed.cleaned);

    // ── Step 3: Cache check ──────────────────────────────────────────────────
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      logger.info("cache", "Cache hit", { cacheKey: cacheKey.slice(0, 16) + "…" });
      return { success: true, data: cached, fromCache: true, attempts: 0 };
    }

    // ── Steps 4–7: LLM call with retry loop ──────────────────────────────────
    const { data, attempts, error, errorCode } = await this.classifyWithRetry(
      input.description,
      preprocessed.cleaned
    );

    if (!data) {
      logger.error("orchestrator", "Pipeline failed", { error, attempts });
      return {
        success: false,
        ...(error && { error }),
        ...(errorCode && { errorCode }),
        attempts,
      };
    }

    // ── Step 7: Build EF output ──────────────────────────────────────────────
    const efOutput: EFOutput = {
      raw_description: input.description,
      normalized_output: {
        clean_product_name: data.clean_product_name,
        brand: data.brand,
        product_type: data.product_type,
        subtype: data.subtype,
        keywords: data.keywords,
        use_case: data.use_case,
        material: data.material,
        confidence: data.confidence,
      },
      final_validated_classification: {
        sector: data.sector,
        category: data.category,
        unit_type: data.unit_type,
      },
      reasoning: data.reasoning,
    };

    // ── Step 8: Store in cache ───────────────────────────────────────────────
    await this.cache.set(cacheKey, efOutput);
    logger.info("orchestrator", "Classification complete", {
      clean_product_name: data.clean_product_name,
      sector: data.sector,
      category: data.category,
      unit_type: data.unit_type,
      confidence: data.confidence,
      attempts,
    });

    return { success: true, data: efOutput, fromCache: false, attempts };
  }

  // ─── Private: LLM + retry loop ──────────────────────────────────────────────

  private async classifyWithRetry(
    _rawDescription: string,
    cleanedDescription: string
  ): Promise<{
    data?: RawLLMOutput;
    attempts: number;
    error?: string;
    errorCode?: PipelineErrorCode;
  }> {
    let lastRaw = "";
    let lastErrors: string[] = [];
    const maxAttempts = this.options.maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      logger.info("llm", `LLM attempt ${attempt}/${maxAttempts}`, { cleanedDescription });

      try {
        const prompt =
          attempt === 1
            ? buildClassificationPrompt(cleanedDescription, this.taxonomy)
            : buildCorrectionPrompt(cleanedDescription, lastRaw, lastErrors, this.taxonomy);

        const response = await this.llm.complete({
          prompt,
          systemPrompt: CLASSIFICATION_SYSTEM_PROMPT,
          maxTokens: CONFIG.llm.maxTokens,
          temperature: CONFIG.llm.temperature,
        });

        lastRaw = response.raw;
        logger.debug("llm", "Raw LLM response", { raw: response.raw.slice(0, 300) });

        const validation = validateTaxonomy(response.parsed, this.taxonomy);

        if (validation.valid && validation.data) {
          logger.info("validator", "Validation passed", { attempt });
          return { data: validation.data, attempts: attempt };
        }

        lastErrors = validation.errors;
        logger.warn("validator", `Validation failed (attempt ${attempt})`, {
          errors: validation.errors,
        });

      } catch (err) {
        const isLLMError = err instanceof LLMCallError;
        const message = err instanceof Error ? err.message : String(err);
        lastErrors = [message];
        logger.error("llm", `LLM call error on attempt ${attempt}`, { error: message });

        // Non-retriable LLM errors (auth, quota) — fail immediately
        if (isLLMError && (err as LLMCallError).statusCode === 401) {
          return {
            attempts: attempt,
            error: message,
            errorCode: PipelineErrorCode.LLM_CALL_FAILURE,
          };
        }
      }
    }

    const exhausted = new RetryExhaustedError(maxAttempts, lastErrors);
    return {
      attempts: maxAttempts,
      error: exhausted.message,
      errorCode: PipelineErrorCode.RETRY_EXHAUSTED,
    };
  }
}

// ─── Singleton convenience ────────────────────────────────────────────────────

let _defaultPipeline: ClassificationPipeline | null = null;

export function getDefaultPipeline(): ClassificationPipeline {
  if (!_defaultPipeline) {
    _defaultPipeline = new ClassificationPipeline();
  }
  return _defaultPipeline;
}

/** Top-level convenience function matching the original spec interface */
export async function normalizeLineItem(input: LineItem): Promise<PipelineResult> {
  return getDefaultPipeline().normalizeLineItem(input);
}