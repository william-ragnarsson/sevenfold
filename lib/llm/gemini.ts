import { GoogleGenAI, ThinkingLevel as GeminiThinkingLevel, type ThinkingConfig } from "@google/genai";
import { getGeminiApiKey, getOcrMaxTokens, getWriteMaxTokens } from "@/lib/config";
import type {
  LlmProvider,
  ResearchOutput,
  SystemPrompt,
  ThinkingLevel,
  TokenUsage,
  WebSource,
} from "./types";
import type { GenerateContentResponseUsageMetadata, Interactions } from "@google/genai";

function ai(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() });
}

/**
 * Gemini's `systemInstruction` takes a plain string; join `SystemPrompt`
 * blocks in order (there's no explicit-cache API wired up here, so the
 * `cache` marker is a no-op on this provider — Gemini's implicit caching
 * still applies to the identical leading portion of the joined string).
 */
function toSystemInstruction(system: SystemPrompt): string {
  return typeof system === "string" ? system : system.map((b) => b.text).join("\n\n");
}

/**
 * How each model takes its thinking setting, and the least it accepts.
 *
 * Least is what this pipeline wants by default: thinking is billed as output,
 * and it spends the output-token budget on hidden reasoning, which can truncate
 * a stream before the trailing fields land. From Google's thinking docs, plus
 * the live checks noted:
 *
 *   model                   setting          least     notes
 *   gemini-3.8-flash        thinkingLevel    LOW       MINIMAL is an error
 *   gemini-3.7-flash        thinkingLevel    LOW       MINIMAL is an error
 *   gemini-3.6-flash        thinkingLevel    MINIMAL
 *   gemini-3.5-flash        thinkingLevel    MINIMAL   measured: budget 0 works too
 *   gemini-3.5-flash-lite   thinkingLevel    MINIMAL   the default; measured: budget 0 → 400
 *   gemini-3.1-flash-lite   thinkingLevel    MINIMAL   the default
 *   gemini-2.5-flash        thinkingBudget   0         measured: MINIMAL → 400
 *   gemini-2.5-flash-lite   thinkingBudget   0         doesn't think unless given a budget
 *
 * 3.7 and 3.8 Flash aren't in KNOWN_MODELS (lib/config.ts); their rows are here
 * so adding them is a one-line change there. On 3.x, MINIMAL "does not
 * guarantee that thinking is off", so some output budget still goes to
 * reasoning. If scorecards start arriving truncated, raise WRITE_MAX_TOKENS
 * before suspecting the parser.
 *
 * An id not in the table is guessed from its version: 2.x takes a budget, and
 * anything newer takes LOW, the least level every 3.x model in Google's tables
 * accepts.
 */
const THINKING: Record<string, { setting: "level" | "budget"; least: ThinkingLevel }> = {
  "gemini-3.8-flash": { setting: "level", least: "low" },
  "gemini-3.7-flash": { setting: "level", least: "low" },
  "gemini-3.6-flash": { setting: "level", least: "minimal" },
  "gemini-3.5-flash": { setting: "level", least: "minimal" },
  "gemini-3.5-flash-lite": { setting: "level", least: "minimal" },
  "gemini-3.1-flash-lite": { setting: "level", least: "minimal" },
  "gemini-2.5-flash": { setting: "budget", least: "minimal" },
  "gemini-2.5-flash-lite": { setting: "budget", least: "minimal" },
};

const LEVELS: readonly ThinkingLevel[] = ["minimal", "low", "medium", "high"];

/**
 * Thinking budgets for the 2.x models, which take a token count instead of a
 * level. 0 turns thinking off; 24576 is the most either 2.5 Flash model takes.
 */
const BUDGET: Record<ThinkingLevel, number> = { minimal: 0, low: 1024, medium: 8192, high: 24576 };

const SDK_LEVEL: Record<ThinkingLevel, GeminiThinkingLevel> = {
  minimal: GeminiThinkingLevel.MINIMAL,
  low: GeminiThinkingLevel.LOW,
  medium: GeminiThinkingLevel.MEDIUM,
  high: GeminiThinkingLevel.HIGH,
};

/** The level `model` will run at when asked for `wanted`: never below its least. */
function thinkingOf(model: string, wanted: ThinkingLevel = "minimal") {
  const major = Number(/^gemini-(\d+)/.exec(model)?.[1]);
  const known =
    THINKING[model] ??
    (Number.isFinite(major) && major < 3
      ? { setting: "budget" as const, least: "minimal" as const }
      : { setting: "level" as const, least: "low" as const });
  const level = LEVELS.indexOf(wanted) < LEVELS.indexOf(known.least) ? known.least : wanted;
  return { setting: known.setting, level };
}

/** `thinkingOf` as generateContent's thinkingConfig. */
function thinkingConfig(model: string, wanted: ThinkingLevel | undefined): ThinkingConfig {
  const { setting, level } = thinkingOf(model, wanted);
  return setting === "budget" ? { thinkingBudget: BUDGET[level] } : { thinkingLevel: SDK_LEVEL[level] };
}

/**
 * Normalize a Gemini `usageMetadata` object to the provider-agnostic shape,
 * which follows Anthropic's: input excludes cache reads. Gemini's prompt count
 * includes the cached tokens, so they're taken out here, or `costOf` would bill
 * them twice (at the input rate and again at the cache rate). Search results
 * fed back to the model bill as input, and thinking bills as output.
 */
function usageOf(usage: GenerateContentResponseUsageMetadata | undefined, model: string): TokenUsage {
  const cached = usage?.cachedContentTokenCount ?? 0;
  return {
    inputTokens: Math.max(0, (usage?.promptTokenCount ?? 0) - cached) + (usage?.toolUsePromptTokenCount ?? 0),
    outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
    cacheReadTokens: cached,
    cacheCreationTokens: 0,
    model,
    provider: "gemini",
  };
}

/**
 * The same, for the Interactions API's usage block, plus the searches. Google
 * reports a count per grounding tool; `queries` is how many distinct queries
 * the stream showed. Gemini 3.x bills per query, so the larger of the two is
 * kept: a cost estimate that runs high rather than low.
 */
function interactionUsageOf(usage: Interactions.Usage | undefined, model: string, queries: number): TokenUsage {
  const cached = usage?.total_cached_tokens ?? 0;
  const searches = (usage?.grounding_tool_count ?? [])
    .filter((tool) => tool.type === "google_search")
    .reduce((sum, tool) => sum + (tool.count ?? 0), 0);
  return {
    inputTokens: Math.max(0, (usage?.total_input_tokens ?? 0) - cached) + (usage?.total_tool_use_tokens ?? 0),
    outputTokens: (usage?.total_output_tokens ?? 0) + (usage?.total_thought_tokens ?? 0),
    cacheReadTokens: cached,
    cacheCreationTokens: 0,
    webSearches: Math.max(searches, queries),
    model,
    provider: "gemini",
  };
}

/** Google Gemini adapter — translates the generic capabilities to the SDK. */
export const geminiProvider: LlmProvider = {
  name: "gemini",

  async transcribePdf(pdf, model, instruction, { onUsage, onText, thinking, signal } = {}) {
    // Stream, for the same reason the Claude adapter does (see claude.ts): a whole
    // image-only deck plus a transcription of up to OCR_MAX_TOKENS is one very long
    // request, and the non-streaming endpoint gives up on it server-side with
    // 503 UNAVAILABLE "Deadline expired before operation could complete". Keeping
    // bytes flowing avoids that entirely. The chunks also drive the live deck
    // scan: the vision-OCR extractor splits them into slides as they arrive.
    const stream = await ai().models.generateContentStream({
      model,
      contents: [
        { inlineData: { mimeType: "application/pdf", data: pdf.toString("base64") } },
        { text: instruction },
      ],
      // Thinking at OCR_THINKING, the model's least by default, so as much of the
      // budget as possible goes to transcription.
      config: { maxOutputTokens: getOcrMaxTokens(), thinkingConfig: thinkingConfig(model, thinking), abortSignal: signal },
    });

    let text = "";
    let lastUsage: GenerateContentResponseUsageMetadata | undefined;
    for await (const chunk of stream) {
      // Usage arrives cumulatively; the final chunk carries the totals.
      if (chunk.usageMetadata) lastUsage = chunk.usageMetadata;
      if (chunk.text) {
        text += chunk.text;
        onText?.(chunk.text);
      }
    }
    onUsage?.(usageOf(lastUsage, model));
    return text.trim();
  },

  async researchWeb({ model, system, user, onSearch, onSource, onText, onUsage, thinking, signal }): Promise<ResearchOutput> {
    // The Interactions API rather than generateContent: it streams each Google
    // Search call as a step the moment the model makes it, so searches show up
    // live like Claude's. generateContent only reports its grounding in one burst
    // at the end. Sources arrive as url_citation annotations on the answer text;
    // their URLs are Google redirect links.
    //
    // Interactions takes a thinking level but no budget, so a 2.x model runs at
    // its own default here: 2.5 Flash-Lite doesn't think, 2.5 Flash thinks as
    // much as it likes.
    const { setting, level } = thinkingOf(model, thinking);
    const stream = await ai().interactions.create(
      {
        model,
        input: user,
        system_instruction: toSystemInstruction(system),
        tools: [{ type: "google_search" }],
        ...(setting === "level" ? { generation_config: { thinking_level: level } } : {}),
        stream: true,
        store: false,
      },
      { signal },
    );

    const sources: WebSource[] = [];
    const seenQueries = new Set<string>();
    const seenSources = new Set<string>();
    let findings = "";
    let status: string | undefined;
    let usage: Interactions.Usage | undefined;

    const search = (queries: string[] | undefined) => {
      for (const query of queries ?? []) {
        if (!query || seenQueries.has(query)) continue;
        seenQueries.add(query);
        onSearch?.(query);
      }
    };
    const cite = (annotations: Interactions.Annotation[] | undefined) => {
      for (const annotation of annotations ?? []) {
        if (annotation.type !== "url_citation" || !annotation.url || seenSources.has(annotation.url)) continue;
        seenSources.add(annotation.url);
        const source: WebSource = { title: annotation.title || annotation.url, url: annotation.url };
        sources.push(source);
        onSource?.(source);
      }
    };
    const write = (text: string) => {
      findings += text;
      onText?.(text); // surface findings prose live (observational only)
    };

    for await (const event of stream) {
      if (event.event_type === "step.start") {
        const step = event.step;
        if (step.type === "google_search_call") search(step.arguments?.queries);
        if (step.type === "model_output") {
          for (const content of step.content ?? []) {
            if (content.type !== "text") continue;
            if (content.text) write(content.text);
            cite(content.annotations);
          }
        }
      } else if (event.event_type === "step.delta") {
        const delta = event.delta;
        if (delta.type === "google_search_call") search(delta.arguments?.queries);
        else if (delta.type === "text") write(delta.text);
        else if (delta.type === "text_annotation_delta") cite(delta.annotations);
      } else if (event.event_type === "interaction.completed") {
        status = event.interaction.status;
        usage = event.interaction.usage;
      } else if (event.event_type === "error") {
        throw new Error(`Gemini interaction failed: ${event.error?.message ?? event.error?.code ?? "unknown error"}`);
      }
    }

    console.log(`[gemini.researchWeb] status=${status} findingsLen=${findings.length} queries=${seenQueries.size} sources=${sources.length}`);
    onUsage?.(interactionUsageOf(usage, model, seenQueries.size));
    return { findings: findings.trim(), sources };
  },

  async generateStream({ model, system, user, onText, onUsage, thinking, jsonSchema, signal }) {
    // No tools — stream text. Most callers parse NDJSON field lines, which is
    // many JSON lines rather than one object, so JSON mode is only on when the
    // caller passes a schema for a single object; then Gemini can't answer in
    // any other shape. Thinking is at the stage's level, the model's least by
    // default: it's ON otherwise and spends the output-token budget on hidden
    // reasoning, which can truncate the stream before the trailing fields land.
    const stream = await ai().models.generateContentStream({
      model,
      contents: user,
      config: {
        systemInstruction: toSystemInstruction(system),
        maxOutputTokens: getWriteMaxTokens(),
        thinkingConfig: thinkingConfig(model, thinking),
        ...(jsonSchema ? { responseMimeType: "application/json", responseJsonSchema: jsonSchema } : {}),
        abortSignal: signal,
      },
    });
    let text = "";
    let lastUsage: GenerateContentResponseUsageMetadata | undefined;
    for await (const chunk of stream) {
      if (chunk.usageMetadata) lastUsage = chunk.usageMetadata;
      if (chunk.text) {
        text += chunk.text;
        onText?.(chunk.text);
      }
    }
    onUsage?.(usageOf(lastUsage, model));
    return text.trim();
  },
};
