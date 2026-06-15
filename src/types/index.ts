// ─── Input / Output contracts ────────────────────────────────────────────────

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

/** Normalized product information extracted by the LLM */
export interface NormalizedOutput {
  clean_product_name: string;
  brand: string | null;
  product_type: string | null;
  subtype: string | null;
  keywords: string[];
  use_case: string | null;
  material: string | null;
  confidence: number;
}

/** Taxonomy-validated classification fields */
export interface FinalClassification {
  sector: string;
  category: string;
  unit_type: string;
}

/** EF-compatible top-level pipeline output */
export interface EFOutput {
  raw_description: string;
  normalized_output: NormalizedOutput;
  final_validated_classification: FinalClassification;
  reasoning: string;
}

// ─── Internal pipeline types ──────────────────────────────────────────────────

export interface PreprocessedInput {
  original: string;
  cleaned: string;
  quantity: number;
  unitPrice: number;
}

export interface LLMRequest {
  prompt: string;
  systemPrompt: string;
  maxTokens: number;
  temperature?: number;
}

export interface LLMResponse {
  raw: string;
  parsed: unknown;
}

/** Raw LLM response before taxonomy validation — combines normalization + classification */
export interface RawLLMOutput {
  // Normalization fields
  clean_product_name: string;
  brand: string | null;
  product_type: string | null;
  subtype: string | null;
  keywords: string[];
  use_case: string | null;
  material: string | null;
  confidence: number;
  // Classification fields
  sector: string;
  category: string;
  unit_type: string;
  reasoning: string;
}

/** Result of the taxonomy validation step */
export interface TaxonomyValidationResult {
  valid: boolean;
  errors: string[];
  data?: RawLLMOutput;
}

/** State carried across retry attempts */
export interface RetryState {
  attempt: number;
  lastRaw: string;
  lastErrors: string[];
}

// ─── Taxonomy data structures ─────────────────────────────────────────────────

export interface TaxonomyStore {
  sectors: ReadonlySet<string>;
  categories: ReadonlySet<string>;
  unitTypes: ReadonlySet<string>;
  /** Maps sector → set of valid categories */
  sectorCategoryMap: ReadonlyMap<string, ReadonlySet<string>>;
}

// ─── Service interfaces (for DI / swappability) ───────────────────────────────

export interface ILLMService {
  complete(request: LLMRequest): Promise<LLMResponse>;
}

export interface ICacheService {
  get(key: string): Promise<EFOutput | null>;
  set(key: string, value: EFOutput): Promise<void>;
  has(key: string): Promise<boolean>;
}

// ─── Pipeline result ──────────────────────────────────────────────────────────

export interface PipelineResult {
  success: boolean;
  data?: EFOutput;
  error?: string;
  errorCode?: PipelineErrorCode;
  fromCache?: boolean;
  attempts?: number;
}

export enum PipelineErrorCode {
  JSON_PARSE_FAILURE = "JSON_PARSE_FAILURE",
  TAXONOMY_VALIDATION_FAILURE = "TAXONOMY_VALIDATION_FAILURE",
  RETRY_EXHAUSTED = "RETRY_EXHAUSTED",
  LLM_CALL_FAILURE = "LLM_CALL_FAILURE",
  TAXONOMY_LOAD_FAILURE = "TAXONOMY_LOAD_FAILURE",
}

// Legacy alias — keeps old code that imports FeatureVector compiling
export type FeatureVector = NormalizedOutput;

// Legacy alias for backward compat with old cache/validator tests
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  data?: NormalizedOutput;
}