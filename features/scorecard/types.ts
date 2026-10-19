/**
 * The 6 evaluation metrics (each 1–5) plus the funding amount — the inputs to
 * the custom invest/don't-invest model.
 */
export interface Scorecard {
  team: number;
  technology: number;
  marketSize: number;
  valueProposition: number;
  competitiveAdvantage: number;
  socialImpact: number;
  /**
   * Funding the startup has already raised to date (not the ask), whole US
   * dollars. 0 = confirmed nothing raised; null = not known. The model was
   * trained with that distinction, so unknown must not be collapsed into 0.
   */
  funding: number | null;
}

export interface ScorecardForm {
  scorecard: Scorecard;
}

export interface ScorecardState {
  /**
   * True on every run since the regression model: `form.scorecard.funding` is
   * whole US dollars and 0 means nothing raised. Reports saved before it lack
   * the flag; there 0 meant unknown and amounts were in the deck's currency.
   */
  fundingInUsd?: true;
}
