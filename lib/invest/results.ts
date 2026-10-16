import card from "@/lib/invest/model-card.json";

/**
 * The numbers behind the public /model page, picked out of the model card.
 *
 * Everything here is an aggregate. The card also carries per-session dates, the
 * recipe strings from the settings search and the hand-made funding overrides.
 * None of those are read here, field by field, so none of them can reach a
 * page: import from this module, never from the card directly.
 *
 * Server-only in practice: the charts are server components, so the card is
 * read at build time and only the rendered numbers ship.
 */

const metrics = card.evaluation.metrics;
const cm = card.evaluation.confusion_matrix;

/** Session-grouped nested CV (10 × 5-fold): the conservative headline. */
export const HELD_OUT = {
  accuracy: metrics.accuracy.mean,
  recall: metrics.recall.mean,
  precision: metrics.precision.mean,
  rocAuc: metrics.roc_auc.mean,
  rocAucSd: metrics.roc_auc.sd,
  brier: metrics.brier.mean,
  priorBrier: card.evaluation.baselines.prior_brier,
  /** Ranking test for "add up the six star ratings". */
  starSumRocAuc: card.evaluation.baselines.criteria_sum_roc_auc,
  repeats: 10,
  folds: 5,
};

/**
 * The confusion matrix as "out of 100 decks", by largest remainder so the four
 * counts are whole numbers that still add up to exactly 100.
 */
function per100(counts: Record<string, number>): Record<string, number> {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const raw = Object.entries(counts).map(([k, v]) => ({ k, exact: (v / total) * 100 }));
  const out = Object.fromEntries(raw.map(({ k, exact }) => [k, Math.floor(exact)]));
  let left = 100 - Object.values(out).reduce((a, b) => a + b, 0);
  for (const { k } of [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (left-- <= 0) break;
    out[k] += 1;
  }
  return out;
}

const p100 = per100({
  bothInvest: cm.invest_invest,
  bothPass: cm.pass_pass,
  missed: cm.invest_pass,
  falseAlarm: cm.pass_invest,
});

export const PER_100 = {
  bothInvest: p100.bothInvest,
  bothPass: p100.bothPass,
  /** I backed it, the model passed. */
  missed: p100.missed,
  /** The model said invest, I passed. */
  falseAlarm: p100.falseAlarm,
};

if (PER_100.bothInvest + PER_100.bothPass + PER_100.missed + PER_100.falseAlarm !== 100) {
  throw new Error("PER_100 must add up to 100");
}

/** Decks out of 100 where the model made the same call I did. */
export const AGREE_PER_100 = PER_100.bothInvest + PER_100.bothPass;

const fc = card.forward_chaining;
// Only the counts. Each entry also holds the session's date and recipe, which
// stay in the card.
const fcInvest = fc.per_session.reduce((n, s) => n + s.invest, 0);
const fcCorrect = fc.per_session.reduce((n, s) => n + s.correct, 0);

/** The newest meetings, each scored by a model trained only on earlier ones. */
export const FUTURE = {
  sessions: fc.sessions,
  rows: fc.rows,
  accuracy: fc.metrics.accuracy,
  correct: fcCorrect,
  invest: fcInvest,
  caught: Math.round(fc.metrics.recall * fcInvest),
  rocAuc: fc.metrics.roc_auc,
};

export const DATA = {
  rows: card.data.rows,
  sessions: card.data.sessions,
};

export const GATE = card.gate.threshold;

export const RECIPE = {
  trees: card.recipe.max_iter,
  leaves: card.recipe.max_leaf_nodes,
  learningRate: card.recipe.learning_rate,
  halfLifeSessions: card.training_weights.recency_half_life_sessions,
  /** How much the oldest meeting counts next to the newest. */
  oldestVsNewest: card.training_weights.oldest_vs_newest,
};

/** Share of all decks over the gate if every one had raised this much. */
export const FUNDING = card.response.funding.map((f) => ({
  usd: f.funding_usd,
  investShare: f.invest_share,
}));

/** Score with all six ratings at 5 and $3M raised (Model Lab funding sweep). */
export const NEAR_PERFECT_AT_3M = 0.49754;

/**
 * Ranking test by number of meetings trained on: hold out five random
 * meetings, train on k of the rest, repeat 100 times. Adding up the stars,
 * scored on the same held-out meetings, sits flat at 0.752. From the Model Lab
 * runs for the shipped model (not in the card); an aggregate, no rows.
 */
export const LEARNING = {
  curve: [
    { meetings: 3, rocAuc: 0.79903 },
    { meetings: 5, rocAuc: 0.82694 },
    { meetings: 7, rocAuc: 0.84326 },
    { meetings: 9, rocAuc: 0.85201 },
    { meetings: 11, rocAuc: 0.85935 },
    { meetings: 13, rocAuc: 0.86222 },
    { meetings: 15, rocAuc: 0.86318 },
    { meetings: 17, rocAuc: 0.86491 },
  ],
  starSumRocAuc: 0.75168,
};

/** Whole percent, the way every figure on the page is printed. */
export const pct = (x: number) => `${Math.round(x * 100)}%`;
