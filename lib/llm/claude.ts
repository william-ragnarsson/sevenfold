import Anthropic from "@anthropic-ai/sdk";
import {
  getAnthropicApiKey,
  getOcrMaxTokens,
  getResearchMaxContinuations,
  getResearchMaxSearches,
  getResearchMaxTokens,
  getWriteMaxTokens,
  modelSupportsEffort,
} from "@/lib/config";
import type {
  LlmProvider,
  ResearchOutput,
  SystemPrompt,
  ThinkingLevel,
  TokenUsage,
  WebSource,
} from "./types";

function client(): Anthropic {
  return new Anthropic({ apiKey: getAnthropicApiKey() });
}

/**
 * Map the generic `SystemPrompt` to Anthropic's system param shape, applying
 * a cache_control breakpoint to blocks marked `cache: true`. The
 * playbook+deck prefix is large and byte-identical across stages/calls, so
 * caching it turns repeat reads (research continuations, later pipeline
 * stages within the 5-min window) into cheap cache hits instead of
 * full-price input tokens.
 */
function toSystem(system: SystemPrompt): string | Anthropic.TextBlockParam[] {
  if (typeof system === "string") return system;
  return system.map((block) => ({
    type: "text" as const,
    text: block.text,
    ...(block.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
}

/** Join the text blocks of a message into one trimmed string. */
function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * How each Claude model turns thinking off, for the "minimal" level. Haiku 5.5
 * takes `disabled`; Sonnet 5.5 rejects that (400) and uses `between_tools`,
 * which only it accepts. Opus 5.5 can't turn thinking off at all, so it isn't
 * listed: effort "low" is its floor. Models not listed get no `thinking` param,
 * which on the older ones (Haiku 4.5, Opus 4.8) already means no thinking.
 */
const THINKING_OFF: Record<string, { type: string }> = {
  "claude-haiku-5-5": { type: "disabled" },
  "claude-sonnet-5-5": { type: "between_tools" },
};

/** Claude's effort for each thinking level. Claude has no "minimal" effort. */
const EFFORT: Record<ThinkingLevel, "low" | "medium" | "high"> = {
  minimal: "low",
  low: "low",
  medium: "medium",
  high: "high",
};

/**
 * The thinking and effort params for a stage's thinking level. Unset means
 * "minimal": effort low with thinking off where the model allows it, the
 * cheapest setting each model takes. "low" and up leave adaptive thinking on
 * and set its effort. Thinking bills as output and counts toward `max_tokens`.
 */
function thinkingParams(model: string, level: ThinkingLevel = "minimal") {
  const off = level === "minimal" ? THINKING_OFF[model] : undefined;
  return {
    ...(off ? { thinking: off as Anthropic.ThinkingConfigParam } : {}),
    ...(modelSupportsEffort(model) ? { output_config: { effort: EFFORT[level] } } : {}),
  };
}

/**
 * Throw on a safety refusal, which comes back as a 200 with no answer text.
 * The stage then fails with a clear reason instead of parsing an empty reply.
 */
function assertAnswered(message: Anthropic.Message, model: string): void {
  if (message.stop_reason !== "refusal") return;
  const category = (message as { stop_details?: { category?: string } }).stop_details?.category;
  throw new Error(`${model} declined the request${category ? ` (${category})` : ""}.`);
}

/**
 * The web search tool version for a model. The 20260209 version filters
 * results with code and is documented for Opus and Sonnet (4.6 and later);
 * Haiku gets the basic 20250305 version.
 */
function webSearchType(model: string) {
  return model.startsWith("claude-haiku")
    ? ("web_search_20250305" as const)
    : ("web_search_20260209" as const);
}

/** Normalize an Anthropic `Usage` object to the provider-agnostic shape. */
function usageOf(usage: Anthropic.Usage, model: string): TokenUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    webSearches: usage.server_tool_use?.web_search_requests,
    model,
    provider: "claude",
  };
}

/**
 * Anthropic Claude adapter — translates the generic capabilities to the SDK.
 *
 * Every stage defaults to a Claude model (see the stage defaults in
 * `lib/config.ts`). Gemini (`lib/llm/gemini.ts`) stays wired up: pointing a
 * stage at a `gemini-*` id routes there with no other change, which is also
 * the recovery from a Claude outage.
 *
 * `getAnthropicApiKey()` is read at call time, so no Anthropic key is required
 * while nothing routes here.
 */
export const claudeProvider: LlmProvider = {
  name: "claude",

  async transcribePdf(pdf, model, instruction, { onUsage, onText, thinking, signal } = {}) {
    // Stream to avoid HTTP timeouts on long transcriptions; the deltas also feed
    // the live deck scan.
    const stream = client().messages.stream(
      {
        model,
        max_tokens: getOcrMaxTokens(),
        ...thinkingParams(model, thinking),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdf.toString("base64"),
                },
              },
              { type: "text", text: instruction },
            ],
          },
        ],
      },
      { signal },
    );
    if (onText) stream.on("text", (delta: string) => onText(delta));
    const message = await stream.finalMessage();
    onUsage?.(usageOf(message.usage, model));
    assertAnswered(message, model);
    return textOf(message.content);
  },

  async researchWeb({ model, system, user, onSearch, onSource, onText, onUsage, thinking, signal }): Promise<ResearchOutput> {
    const c = client();
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
    const maxContinuations = getResearchMaxContinuations();
    const params = {
      model,
      max_tokens: getResearchMaxTokens(),
      system: toSystem(system),
      tools: [
        {
          type: webSearchType(model),
          name: "web_search" as const,
          max_uses: getResearchMaxSearches(),
          // Restrict to direct calls: the tool's default caller set includes
          // programmatic (code-execution) calling, which not every model
          // supports ("does not support programmatic tool calling"). Direct is
          // all this pipeline ever needs (no code execution tool is declared).
          allowed_callers: ["direct" as const],
        },
      ],
      ...thinkingParams(model, thinking),
    };

    const sources: WebSource[] = [];
    const seen = new Set<string>();

    // server_tool_use blocks carry the query; web_search_tool_result blocks
    // carry the consulted pages (with clean, direct URLs).
    type Stream = ReturnType<typeof c.messages.stream>;
    const attach = (stream: Stream) => {
      // Surface the model's findings prose live (observational only).
      if (onText) stream.on("text", (delta: string) => onText(delta));
      stream.on("contentBlock", (block: Anthropic.ContentBlock) => {
        if (block.type === "server_tool_use" && block.name === "web_search") {
          const query = (block.input as { query?: string } | null)?.query;
          if (query) onSearch?.(query);
        } else if (block.type === "web_search_tool_result") {
          const results = Array.isArray(block.content) ? block.content : [];
          for (const r of results) {
            if (r.type !== "web_search_result" || !r.url || seen.has(r.url)) continue;
            seen.add(r.url);
            const source: WebSource = { title: r.title ?? r.url, url: r.url };
            sources.push(source);
            onSource?.(source);
          }
        }
      });
    };

    let stream = c.messages.stream({ ...params, messages }, { signal });
    attach(stream);
    let response = await stream.finalMessage();
    onUsage?.(usageOf(response.usage, model));

    // The web_search tool runs a server-side loop; resume on pause_turn.
    let continuations = 0;
    while (response.stop_reason === "pause_turn" && continuations < maxContinuations) {
      messages.push({ role: "assistant", content: response.content });
      stream = c.messages.stream({ ...params, messages }, { signal });
      attach(stream);
      response = await stream.finalMessage();
      onUsage?.(usageOf(response.usage, model));
      continuations += 1;
    }
    assertAnswered(response, model);

    return { findings: textOf(response.content), sources };
  },

  async generateStream({ model, system, user, onText, onUsage, thinking, signal }) {
    // No tools — stream plain text (the pipeline parses NDJSON field lines).
    const stream = client().messages.stream(
      {
        model,
        max_tokens: getWriteMaxTokens(),
        ...thinkingParams(model, thinking),
        system: toSystem(system),
        messages: [{ role: "user", content: user }],
      },
      { signal },
    );
    if (onText) stream.on("text", (delta: string) => onText(delta));
    const message = await stream.finalMessage();
    onUsage?.(usageOf(message.usage, model));
    assertAnswered(message, model);
    return textOf(message.content);
  },
};
