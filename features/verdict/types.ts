/** Output of the custom model: invest (1) or don't invest (0). */
export interface InvestVerdict {
  /** True = invest, false = pass. Meaningful only when `available`. */
  invest: boolean;
  /** False if the trained model couldn't run (shows a placeholder + note). */
  available: boolean;
  /**
   * The model's score, 0–1: the invest rate among past decks scored like this
   * one. `invest` is `score >= threshold`.
   */
  score?: number;
  /** The acceptance gate the score must clear, tuned when the model was trained. */
  threshold?: number;
  /** Reports saved before the regression model carry this instead of `score`. */
  probability?: number;
  note?: string;
}

export interface VerdictForm {
  verdict: InvestVerdict | null;
}

export interface VerdictState {
  verdict: InvestVerdict | null;
}

export type VerdictEvent =
  /** The invest/don't-invest verdict from the custom model. */
  { type: "verdict"; verdict: InvestVerdict };
