import { GoogleGenAI, ThinkingLevel, type ThinkingConfig } from "@google/genai";
import { getGeminiApiKey, getOcrMaxTokens, getWriteMaxTokens } from "@/lib/config";
import type {
  LlmProvider,
  ResearchOutput,
  SystemPrompt,
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
 * The least thinking a given model will accept.
 *
 * Thinking off is what this pipeline wants: it spends the output-token budget on
 * hidden reasoning and can truncate a stream before the trailing fields (the
 * scorecard) land. There is no single setting that works across models — this
 * table is measured against the live API, not inferred from docs:
 *
 *                            thinkingBudget: 0    thinkingLevel: MINIMAL
 *   gemini-2.5-flash                ok            400 "not supported for this model"
 *   gemini-3.5-flash                ok            ok
 *   gemini-3.5-flash-lite           400           ok
 *
 * Google's model pages list MINIMAL for 3.6 Flash and 3.1 Flash-Lite too (not
 * yet measured here); 2.5 Flash-Lite takes the budget, like 2.5 Flash. 3.7 and
 * 3.8 Flash reject MINIMAL, which is why they aren't in KNOWN_MODELS.
 *
 * So 2.x takes the numeric budget and 3.x takes the level. Note 3.x cannot truly
 * disable thinking — MINIMAL is the floor and Google's docs say it "does not
 * guarantee that thinking is off" — so on a 3.x model some output budget still goes
 * to reasoning. If scorecards start arriving truncated, raise WRITE_MAX_TOKENS
 * before suspecting the parser.
 *
 * An unrecognised id gets the newer API, the same "assume forward" bet
 * `modelSupportsEffort` makes for Claude in lib/config.ts.
 */
function minimalThinking(model: string): ThinkingConfig {
  const major = Number(/^gemini-(\d+)/.exec(model)?.[1]);
  return Number.isFinite(major) && major < 3
    ? { thinkingBudget: 0 }
    : { thinkingLevel: ThinkingLevel.MINIMAL };
}

/** Normalize a Gemini `usageMetadata` object to the provider-agnostic shape. */
function usageOf(usage: GenerateContentResponseUsageMetadata | undefined, model: string): TokenUsage {
  return {
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
    cacheReadTokens: usage?.cachedContentTokenCount ?? 0,
    cacheCreationTokens: 0,
    model,
    provider: "gemini",
  };
}

/**
 * The same, for the Interactions API's usage block. Search results the model
 * read count as input and its thinking counts as output; Google bills both.
 */
function interactionUsageOf(usage: Interactions.Usage | undefined, model: string): TokenUsage {
  return {
    inputTokens: (usage?.total_input_tokens ?? 0) + (usage?.total_tool_use_tokens ?? 0),
    outputTokens: (usage?.total_output_tokens ?? 0) + (usage?.total_thought_tokens ?? 0),
    cacheReadTokens: usage?.total_cached_tokens ?? 0,
    cacheCreationTokens: 0,
    model,
    provider: "gemini",
  };
}

/** Google Gemini adapter — translates the generic capabilities to the SDK. */
export const geminiProvider: LlmProvider = {
  name: "gemini",

  async transcribePdf(pdf, model, instruction, { onUsage, onText, signal } = {}) {
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
      // Thinking minimised — as much of the budget as possible goes to transcription.
      config: { maxOutputTokens: getOcrMaxTokens(), thinkingConfig: minimalThinking(model), abortSignal: signal },
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

  async researchWeb({ model, system, user, onSearch, onSource, onText, onUsage, signal }): Promise<ResearchOutput> {
    // The Interactions API rather than generateContent: it streams each Google
    // Search call as a step the moment the model makes it, so searches show up
    // live like Claude's. generateContent only reports its grounding in one burst
    // at the end. Sources arrive as url_citation annotations on the answer text;
    // their URLs are Google redirect links.
    const stream = await ai().interactions.create(
      {
        model,
        input: user,
        system_instruction: toSystemInstruction(system),
        tools: [{ type: "google_search" }],
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
    onUsage?.(interactionUsageOf(usage, model));
    return { findings: findings.trim(), sources };
  },

  async generateStream({ model, system, user, onText, onUsage, signal }) {
    // No tools — stream plain text (the pipeline parses NDJSON field lines). We
    // deliberately don't set responseMimeType json: the output is many JSON
    // lines, not one object. Thinking is minimised because it's ON by default and
    // spends the output-token budget on hidden reasoning, which can truncate the
    // stream before the trailing fields (the scorecard) land — see minimalThinking.
    const stream = await ai().models.generateContentStream({
      model,
      contents: user,
      config: {
        systemInstruction: toSystemInstruction(system),
        maxOutputTokens: getWriteMaxTokens(),
        thinkingConfig: minimalThinking(model),
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
