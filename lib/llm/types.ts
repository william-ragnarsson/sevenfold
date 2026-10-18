/**
 * The provider-agnostic LLM boundary. Everything vendor-/SDK-specific lives
 * behind this interface in exactly one file per provider (claude.ts, gemini.ts).
 * The pipeline above is generic and only ever talks to `LlmProvider`.
 */

export type Provider = "gemini" | "claude";

/**
 * One block of a system prompt. `cache: true` marks it as a stable, reusable
 * prefix the provider should cache (Anthropic: an ephemeral cache
 * breakpoint). Blocks are joined in order; only the marked ones are cached.
 */
export interface SystemBlock {
  text: string;
  cache?: boolean;
}

/** A system prompt: a plain string, or ordered blocks where some are cacheable. */
export type SystemPrompt = string | SystemBlock[];

/**
 * How much a model may think before it answers, from least to most. Thinking is
 * billed as output, so each step up costs more. A model that can't go as low as
 * asked runs at its own minimum instead (see `lib/llm/gemini.ts`). Gemini only:
 * the Claude adapter ignores it.
 */
export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

/**
 * A JSON Schema for a reply that must be one JSON object. Gemini enforces it
 * (structured output); Claude ignores it. So the prompt still has to describe
 * the format, and the caller still has to parse the reply defensively.
 */
export type JsonSchema = Record<string, unknown>;

/** A web page consulted during research. */
export interface WebSource {
  title: string;
  url: string;
}

/** Token usage for one LLM call, normalized across providers. */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  /**
   * Web searches the server-side tool ran during this call, if any. Priced per
   * model in `lib/llm/pricing.ts` (some providers bill per search, some once
   * per call that searched).
   */
  webSearches?: number;
  model: string;
  provider: Provider;
}

export interface ResearchArgs {
  /** Concrete model id to run this call on. */
  model: string;
  /** System / instruction prompt. */
  system: SystemPrompt;
  /** User prompt (the deck text + task). */
  user: string;
  /** Called with each search query as it happens. */
  onSearch?: (query: string) => void;
  /** Called with each source as it's consulted. */
  onSource?: (source: WebSource) => void;
  /** Called with each incremental chunk of the model's research notes text. */
  onText?: (delta: string) => void;
  /** Called once per underlying API round-trip with that call's token usage. */
  onUsage?: (usage: TokenUsage) => void;
  /** Least thinking to allow; unset means the model's minimum. */
  thinking?: ThinkingLevel;
  /** Aborts the underlying request(s) — cancel/disconnect stops token burn. */
  signal?: AbortSignal;
}

export interface ResearchOutput {
  /** Prose research notes. */
  findings: string;
  /** Sources consulted (authoritative URL list). */
  sources: WebSource[];
}

export interface GenerateArgs {
  /** Concrete model id to run this call on. */
  model: string;
  system: SystemPrompt;
  user: string;
  /** Called with each incremental chunk of the generated text. */
  onText?: (delta: string) => void;
  /** Called once with this call's token usage. */
  onUsage?: (usage: TokenUsage) => void;
  /** Least thinking to allow; unset means the model's minimum. */
  thinking?: ThinkingLevel;
  /** Shape of the reply, when it's one JSON object rather than free text. */
  jsonSchema?: JsonSchema;
  /** Aborts the underlying request — cancel/disconnect stops token burn. */
  signal?: AbortSignal;
}

export interface TranscribeOptions {
  /** Called once with this call's token usage. */
  onUsage?: (usage: TokenUsage) => void;
  /** Called with each chunk of the transcription as it streams in. */
  onText?: (delta: string) => void;
  /** Least thinking to allow; unset means the model's minimum. */
  thinking?: ThinkingLevel;
  /** Aborts the underlying request — cancel/disconnect stops token burn. */
  signal?: AbortSignal;
}

/**
 * One adapter per LLM vendor. Each method is a generic capability; the
 * implementation translates it into that vendor's SDK calls (model choice,
 * tool/grounding shape, streaming, etc.).
 */
export interface LlmProvider {
  readonly name: Provider;

  /** OCR: transcribe an image-only / scanned PDF to plain text. */
  transcribePdf(pdf: Buffer, model: string, instruction: string, options?: TranscribeOptions): Promise<string>;

  /** Research the web; stream queries/sources; return findings + sources. */
  researchWeb(args: ResearchArgs): Promise<ResearchOutput>;

  /**
   * Generate text (ungrounded, no tools), streaming chunks via `onText`, and
   * return the full text. Used to stream the NDJSON form-field fill.
   */
  generateStream(args: GenerateArgs): Promise<string>;
}
