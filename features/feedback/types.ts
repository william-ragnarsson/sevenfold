/** How serious a piece of deck feedback is. */
export type DeckFeedbackSeverity = "critical" | "warning" | "strength";

/** One qualitative critique of the pitch deck itself (not a form field). */
export interface DeckFeedbackItem {
  severity: DeckFeedbackSeverity;
  /** e.g. "Team", "Competition", "Market", "Deck Basics". */
  category: string;
  /** Short label, e.g. "No competitors slide". */
  title: string;
  /** 1–2 sentences of explanation, tied to the playbook where relevant. */
  detail: string;
  /**
   * The deck pages (1-based, sorted) the item is about, when the model cited
   * any. Absent on feedback saved before items cited slides, and on items about
   * the deck as a whole or about something it lacks.
   */
  slides?: number[];
}

export interface FeedbackForm {
  /** Qualitative critique of the deck itself — gaps, weaknesses, strengths. */
  deckFeedback: DeckFeedbackItem[];
}

export interface FeedbackState {
  deckFeedback: DeckFeedbackItem[];
}

export type FeedbackEvent =
  /** A piece of deck feedback (gap/weakness/strength) was generated. */
  { type: "feedback"; item: DeckFeedbackItem };
