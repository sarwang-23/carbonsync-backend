import type { ILLMService, LLMRequest, LLMResponse } from "../types/index.js";
import { JSONParseError, LLMCallError } from "../errors/index.js";

// Strips markdown fences and extracts the outermost JSON object from a raw LLM response.
// Throws JSONParseError if no valid JSON object is found — caught by the retry loop upstream.
function extractJSON(raw: string): unknown {
  const stripped = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new JSONParseError(raw, new Error("No JSON object found in response"));
  }

  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch (err) {
    throw new JSONParseError(raw, err);
  }
}

// ─── Anthropic API shapes ─────────────────────────────────────────────────────

// Matches the Anthropic Messages API request body
interface AnthropicRequestBody {
  model: string;
  max_tokens: number;
  temperature: number;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

// Matches the Anthropic Messages API response body
interface AnthropicResponseBody {
  content: Array<{ type: string; text: string }>;
  stop_reason: string;
  error?: { message: string };
}

// ─── Production implementation — calls the real Anthropic API ─────────────────

export class AnthropicLLMService implements ILLMService {
  private readonly apiUrl = "https://api.anthropic.com/v1/messages";
  private readonly apiVersion = "2023-06-01";
  private readonly model = "claude-sonnet-4-20250514";

  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new LLMCallError("Anthropic API key is required");
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const body: AnthropicRequestBody = {
      model: this.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature ?? 0, // 0 = deterministic; callers may override
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.prompt }],
    };

    // Separate try/catch so network errors and non-2xx errors produce distinct messages
    let response: Response;
    try {
      response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": this.apiVersion,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new LLMCallError(`Network error calling Anthropic API: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "<unreadable>");
      throw new LLMCallError(`Anthropic API error ${response.status}: ${errorText}`, response.status);
    }

    // Concatenate all text content blocks (Anthropic may return multiple)
    const responseBody = (await response.json()) as AnthropicResponseBody;
    const raw = responseBody.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Best-effort parse — if extraction fails, parsed=null signals the validator to retry
    let parsed: unknown = null;
    try {
      parsed = extractJSON(raw);
    } catch {
      // parsed stays null; downstream validator will catch this
    }

    return { raw, parsed };
  }
}

// ─── Test double — no network calls, deterministic output ─────────────────────

export class MockLLMService implements ILLMService {
  // Optional factory lets individual tests inject custom responses without subclassing
  constructor(
    private readonly responseFactory?: (request: LLMRequest) => Record<string, unknown>
  ) { }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    // Use injected factory if provided, otherwise return a sensible default payload
    const mockData = this.responseFactory
      ? this.responseFactory(request)
      : {
        clean_product_name: "Sample Product",
        brand: null,
        product_type: "General",
        subtype: null,
        keywords: ["sample", "product"],
        use_case: null,
        material: null,
        confidence: 0.75,
        sector: "Consumer Goods and Services",
        category: "General Retail",
        unit_type: "Number",
        reasoning: "This is a generic consumer product sold through general retail channels.",
      };

    const raw = JSON.stringify(mockData);
    return { raw, parsed: mockData };
  }
}