import type { FormSection } from "@/lib/core/schema";
import { clampRating } from "@/lib/core/parse";
import type { ScorecardForm } from "./types";

export const SCORECARD_SECTION: FormSection = {
  title: "Scorecard",
  fields: [
    { key: "scorecard.team", label: "Team", kind: "rating", hint: "Rate the team 1-5 (strength, completeness, track record)." },
    { key: "scorecard.technology", label: "Technology", kind: "rating", hint: "Rate product/tech maturity 1-5 (1 = prototype/MVP/undeveloped, 5 = market-ready)." },
    { key: "scorecard.marketSize", label: "Market Size", kind: "rating", hint: "Rate the market size 1-5." },
    { key: "scorecard.valueProposition", label: "Value Proposition", kind: "rating", hint: "Rate the value proposition 1-5." },
    { key: "scorecard.competitiveAdvantage", label: "Competitive Advantage", kind: "rating", hint: "Rate the competitive advantage / moat 1-5." },
    { key: "scorecard.socialImpact", label: "Social Impact", kind: "rating", hint: "Rate the social impact 1-5." },
    { key: "scorecard.funding", label: "Funding raised", kind: "number", hint: "Total funding the startup has ALREADY raised to date (not the current ask), as an integer in US dollars (no symbols). 0 = nothing raised; null = unknown." },
  ],
};

/** Keys of the scorecard rating metrics (1–5), in model-feature order. */
export const SCORECARD_METRIC_KEYS = [
  "team",
  "technology",
  "marketSize",
  "valueProposition",
  "competitiveAdvantage",
  "socialImpact",
] as const;

/** An unscored scorecard: every rating 0, funding unknown. */
export function emptyScorecardForm(): ScorecardForm {
  return {
    scorecard: {
      team: 0,
      technology: 0,
      marketSize: 0,
      valueProposition: 0,
      competitiveAdvantage: 0,
      socialImpact: 0,
      funding: null,
    },
  };
}

/**
 * Write a `scorecard.*` key (mutates). Null for any other key, so the caller
 * tries the next product; false for a scorecard key that isn't a metric.
 */
export function applyScorecardField(
  form: ScorecardForm,
  key: string,
  value: unknown,
): boolean | null {
  if (!key.startsWith("scorecard.")) return null;
  const metric = key.slice("scorecard.".length);
  if (metric === "funding") {
    // null / "unknown" / garbage stay unknown; 0 means confirmed nothing raised.
    const n = value === null || value === "" ? Number.NaN : Math.round(Number(value));
    form.scorecard.funding = Number.isFinite(n) && n >= 0 ? n : null;
    return true;
  }
  if (metric in form.scorecard) {
    (form.scorecard as unknown as Record<string, number>)[metric] = clampRating(value);
    return true;
  }
  return false;
}
