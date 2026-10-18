import type { ProgressEvent } from "@/lib/diligence/types";
import type { FeedbackState } from "./types";

export function initialFeedbackState(): FeedbackState {
  return { deckFeedback: [] };
}

export function foldFeedback<S extends FeedbackState>(state: S, event: ProgressEvent): S {
  if (event.type === "feedback") return { ...state, deckFeedback: [...state.deckFeedback, event.item] };
  return state;
}
