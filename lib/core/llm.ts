import { getProvider } from "@/lib/llm";
import type { LlmProvider, TokenUsage } from "@/lib/llm/types";
import { deriveProvider } from "@/lib/config";
import { costOf } from "@/lib/llm/pricing";
import type { CoreEvent, Emit } from "./events";

/** The provider adapter that serves this model id. */
export function providerFor(model: string): LlmProvider {
  return getProvider(deriveProvider(model));
}

/**
 * An `onUsage` callback that reports each call's tokens and cost under this
 * stage label. The labels are persisted in `AnalysisState.usage.byStage`, so
 * an existing one is never renamed.
 */
export function reportUsage(emit: Emit<CoreEvent>, stage: string): (usage: TokenUsage) => void {
  return (usage) => emit({ type: "usage", stage, usage, costUsd: costOf(usage) });
}
