import type { TokenUsage } from "@/lib/llm/types";
import type { DiligencePhase, FieldSource } from "./types";

/**
 * The progress events every product may emit. Products add their own event
 * types next to their code; `lib/diligence/types.ts` unions them all into the
 * `ProgressEvent` that goes over the wire. The `type` strings are persisted
 * and streamed, so they are never renamed.
 */
export type CoreEvent =
  /** A coarse phase change in the pipeline. */
  | { type: "status"; phase: DiligencePhase; message: string }
  /**
   * A single form field was filled in. `value` is JSON for list/number fields.
   * `slides` = the deck pages the model cited for it, when it came from the deck.
   */
  | { type: "field"; key: string; value: unknown; source: FieldSource; slides?: number[] }
  /** Token usage + cost for one LLM call. Dev-only — never sent in production. */
  | { type: "usage"; stage: string; usage: TokenUsage; costUsd: number }
  /** Terminal failure event. */
  | { type: "error"; message: string }
  /**
   * A stage started, finished or failed. `id` is the stage's id, or "deck" for
   * reading the deck. A stage the run never reached sends nothing.
   */
  | { type: "stage"; id: string; state: "start" | "done" | "failed" };

/** How a stage reports progress. Typed on the events it may send. */
export type Emit<E = CoreEvent> = (event: E) => void;
