import type { ProgressEvent } from "@/lib/diligence/types";
import type { VerdictState } from "./types";

export function initialVerdictState(): VerdictState {
  return { verdict: null };
}

export function foldVerdict<S extends VerdictState>(state: S, event: ProgressEvent): S {
  if (event.type === "verdict") return { ...state, verdict: event.verdict };
  return state;
}
