import type { FeedbackForm } from "./types";

export function emptyFeedbackForm(): FeedbackForm {
  return { deckFeedback: [] };
}
