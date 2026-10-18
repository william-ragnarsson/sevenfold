import type { SystemPrompt } from "@/lib/llm/types";
import type { CoreEvent, Emit } from "./events";
import { providerFor, reportUsage } from "./llm";
import { createLineBuffer, parseFieldLine } from "./parse";
import type { FieldSource } from "./types";

interface FillArgs {
  /** Concrete model id to run on; provider is derived from the name. */
  model: string;
  system: SystemPrompt;
  user: string;
  /**
   * Write one field onto the form. Returns true when the key was written, so
   * it should be streamed to the client.
   */
  apply: (key: string, value: unknown, source: FieldSource) => boolean;
  emit: Emit<CoreEvent>;
  /** Label for usage events — distinguishes the extract pass from the complete pass. */
  stage: string;
  /** Aborts the underlying request — cancel/disconnect stops token burn. */
  signal?: AbortSignal;
}

/**
 * Generic field-fill stage. Streams an NDJSON field response from the provider,
 * parses each line as it completes, applies it onto the form, and emits a live
 * `field` event — so the UI fills cells in real time. Used by both the
 * deck-extract pass and the completion pass.
 */
export async function fillFields({ model, system, user, apply, emit, stage, signal }: FillArgs): Promise<void> {
  const lines = createLineBuffer((line) => {
    const parsed = parseFieldLine(line);
    if (!parsed) return;
    if (apply(parsed.key, parsed.value, parsed.source)) {
      const { key, value, source, slides } = parsed;
      emit(slides ? { type: "field", key, value, source, slides } : { type: "field", key, value, source });
    }
  });

  await providerFor(model).generateStream({
    model,
    system,
    user,
    onText: lines.push,
    onUsage: reportUsage(emit, stage),
    signal,
  });

  // Flush any trailing line without a terminating newline.
  lines.flush();
}
