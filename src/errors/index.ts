import { PipelineErrorCode } from "../types/index.js";

// Base class for all pipeline errors — carries an optional structured context payload
export abstract class PipelineError extends Error {
  abstract readonly code: PipelineErrorCode;

  constructor(message: string, public readonly context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name; // ensures stack traces show the subclass name
  }
}

// Thrown when the LLM's response cannot be parsed as JSON
export class JSONParseError extends PipelineError {
  readonly code = PipelineErrorCode.JSON_PARSE_FAILURE;

  constructor(public readonly rawOutput: string, cause?: unknown) {
    super(
      `Failed to parse LLM response as JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
      { rawOutput }
    );
  }
}

// Thrown when a valid JSON response doesn't conform to the expected taxonomy schema
export class TaxonomyValidationError extends PipelineError {
  readonly code = PipelineErrorCode.TAXONOMY_VALIDATION_FAILURE;

  constructor(public readonly validationErrors: string[]) {
    super(`Taxonomy validation failed: ${validationErrors.join("; ")}`, { validationErrors });
  }
}

// Thrown when all retry attempts are exhausted without a valid classification
export class RetryExhaustedError extends PipelineError {
  readonly code = PipelineErrorCode.RETRY_EXHAUSTED;

  constructor(
    public readonly totalAttempts: number,
    public readonly lastErrors: string[]
  ) {
    super(
      `Classification failed after ${totalAttempts} attempt(s). Last errors: ${lastErrors.join("; ")}`,
      { totalAttempts, lastErrors }
    );
  }
}

// Thrown on network failures or non-2xx HTTP responses from the LLM API
export class LLMCallError extends PipelineError {
  readonly code = PipelineErrorCode.LLM_CALL_FAILURE;

  constructor(message: string, public readonly statusCode?: number) {
    super(message, { statusCode });
  }
}

// Thrown when a taxonomy JSON file is missing or malformed at startup
export class TaxonomyLoadError extends PipelineError {
  readonly code = PipelineErrorCode.TAXONOMY_LOAD_FAILURE;

  constructor(filePath: string, cause?: unknown) {
    super(
      `Failed to load taxonomy file "${filePath}": ${cause instanceof Error ? cause.message : String(cause)}`,
      { filePath }
    );
  }
}