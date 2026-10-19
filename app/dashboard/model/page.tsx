import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import AgreementDots from "@/components/features/model/AgreementDots";
import Figure from "@/components/features/model/Figure";
import FundingStep from "@/components/features/model/FundingStep";
import FutureTest from "@/components/features/model/FutureTest";
import LearningCurve from "@/components/features/model/LearningCurve";
import TrainingReplay from "@/components/features/model/TrainingReplay";
import {
  AGREE_PER_100,
  DATA,
  FUTURE,
  GATE,
  HELD_OUT,
  NEAR_PERFECT_AT_3M,
  PER_100,
  RECIPE,
  pct,
} from "@/lib/invest/results";
import { MEDIAN_RATINGS, TRAINING_FRAMES } from "@/lib/invest/training-frames";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "How the model works · SevenFold",
  description:
    "How accurate SevenFold's invest-or-pass model is, what it looks for in a deck, and how it was trained and tested on real VC decisions.",
};

/**
 * The dashboard's explainer for the invest model, written for founders rather than
 * data scientists: results first (how often it agrees with me), then what
 * moves the score, then how it learned, closing with a note that all of it is
 * simplified. Each chart carries one plain sentence; the proper names live in
 * "For the curious" at the bottom.
 * The figures alternate sides (`layout`) so the page doesn't read as one column
 * of identical blocks.
 *
 * Every number comes from `lib/invest/results.ts`, so a retrain updates the page.
 */

const gate100 = Math.round(GATE * 100);
const startScore = Math.round(TRAINING_FRAMES.vp5[0][0]);
const finalVp5 = TRAINING_FRAMES.vp5[TRAINING_FRAMES.vp5.length - 1];
const fixed = (x: number, digits = 3) => x.toFixed(digits);

function Section({ n, title, intro, children }: { n: number; title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-16 border-t border-ink/10 pt-14 sm:space-y-24 sm:pt-20">
      <div className="max-w-2xl space-y-4">
        <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-ink text-sm font-bold text-paper">
            {n}
          </span>
          {title}
        </h2>
        <p className="text-lg leading-relaxed text-muted">{intro}</p>
      </div>
      {children}
    </section>
  );
}

const HEADLINE = [
  { value: pct(HELD_OUT.accuracy), label: "Same call as me, on meetings it never saw" },
  { value: pct(HELD_OUT.rocAuc), label: "Picks the deck I backed over one I passed" },
  { value: String(DATA.rows), label: "Real decisions it learned from" },
];

export default function ModelPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-16 px-6 pb-24 sm:space-y-24">
      <header className="space-y-5 pt-10 sm:pt-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-accent backdrop-blur">
          The model
        </div>
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-ink sm:text-5xl">
          How the model was trained and how it performs.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          SevenFold&apos;s invest-or-pass verdict comes from a model trained on my own decisions as a VC.
          Here&apos;s how often it gets it right, what it pays attention to, and how it learned. No maths
          degree needed.
        </p>

        <dl className="grid max-w-3xl grid-cols-3 gap-4 border-t border-ink/12 pt-6 sm:gap-8">
          {HEADLINE.map((h) => (
            <div key={h.label}>
              <dt className="text-3xl font-bold tabular-nums tracking-tight text-ink sm:text-4xl">{h.value}</dt>
              <dd className="mt-1 text-xs leading-snug text-muted sm:text-sm">{h.label}</dd>
            </div>
          ))}
        </dl>
      </header>

      <Section
        n={1}
        title="How accurate is it?"
        intro="I hid whole meetings from the model, let it learn from the rest, then had it call the decks it had never seen. Then I put its calls next to mine."
      >
        <Figure
          title={`${AGREE_PER_100}% accuracy on verdicts`}
          lead="Each dot is one deck, all from meetings the model never saw while it was learning."
          takeaway={`It made the same invest-or-pass call I did on ${AGREE_PER_100} of every 100 decks.`}
          note="Of the decks I backed, it flagged about 2 in 3. And when it said invest, I agreed about 2 times in 3."
          label={`100 dots. ${PER_100.bothInvest} we both said invest, ${PER_100.bothPass} we both said pass, ${PER_100.missed} I backed but the model passed, ${PER_100.falseAlarm} the model said invest but I passed.`}
        >
          <AgreementDots />
        </Figure>

        <Figure
          layout="stacked"
          title="Tested on the newest meetings"
          lead={`The toughest version: line the meetings up in order, and score each of the newest ${FUTURE.sessions} with a model that only learned from the meetings before it. Just like using it on next week's decks.`}
          takeaway={`The same call as me on ${pct(FUTURE.accuracy)} of those ${FUTURE.rows} decks, and it caught ${FUTURE.caught} of the ${FUTURE.invest} I backed.`}
          note={`Small print: the model's final settings were picked with these meetings in view, so ${pct(FUTURE.accuracy)} is the optimistic end. ${pct(HELD_OUT.accuracy)} is the number I stand behind.`}
          label={`${DATA.sessions} meetings in order. The newest ${FUTURE.sessions}, tested one at a time: same call on ${pct(FUTURE.accuracy)} of ${FUTURE.rows} decks, ${FUTURE.caught} of ${FUTURE.invest} backed decks caught.`}
        >
          <FutureTest />
        </Figure>
      </Section>

      <Section
        n={2}
        title="What it looks for"
        intro={
          <>
            Every deck gets a score from 0 to 100. Read it as: out of 100 decks rated like yours, roughly how
            many got a yes from me. <span className="font-medium text-ink">{gate100} or more is an invest.</span>{" "}
            The bar sits at {gate100}, not 50, so the model says invest about as often as I did: around 1 deck
            in 4.
          </>
        }
      >
        <Figure
          title="How much a startup has raised matters a lot"
          lead="Every deck, scored again as if it had raised the amount on the left. Only the funding changes."
          takeaway="I backed early companies. Up to about $1.6M raised, over 40 in 100 decks clear the bar. Past that, only about 2 in 100 do."
          note={`A near-perfect deck still can: with five stars on everything, a startup that has raised $3M scores about ${Math.round(NEAR_PERFECT_AT_3M * 100)}.`}
          label="Invest calls per 100 decks by amount raised: about 44 to 49 up to $1M, 41 at $1.6M, then about 2 from $1.7M upward. 44 when funding isn't stated."
        >
          <FundingStep />
        </Figure>
      </Section>

      <Section
        n={3}
        title="How it learned"
        intro={`No scraped data, no generic startup advice. It learned from one thing: ${DATA.rows} real invest-or-pass calls I made across ${DATA.sessions} partner meetings, deck by deck.`}
      >
        <Figure
          layout="stacked"
          title="Watch it learn"
          lead={`The model is a stack of ${RECIPE.trees} small rules. Each one looks at what the rules before it got wrong and nudges the scores to fix it. Here are a few made-up decks, scored at every amount raised as the rules pile up.`}
          takeaway={`Before the first rule, every deck scores the same ${startScore}: about how often I said yes. By the last, a strong value proposition carries a deck well over the bar, and raising past about $1.6M pulls almost every deck back under it.`}
          note={`Made-up decks, not real ones: the ratings that aren't shown sit at a typical deck's (team ${MEDIAN_RATINGS.team}, technology ${MEDIAN_RATINGS.technology}, market ${MEDIAN_RATINGS.marketSize}, competitive advantage ${MEDIAN_RATINGS.competitiveAdvantage}, social impact ${MEDIAN_RATINGS.socialImpact}). Two house rules hold throughout: a better rating can never lower the score, and recent meetings count a bit more.`}
        >
          <TrainingReplay
            gate={gate100}
            label={`Line chart of score against amount raised, replayed over ${RECIPE.trees} rules. Every line starts flat at ${startScore}. After the last rule, a deck with value proposition 5 scores ${Math.round(finalVp5[0])} with nothing raised, ${Math.round(finalVp5[4])} at $1.5M and ${Math.round(finalVp5[5])} at $1.7M. Only five stars on everything stays over the bar of ${gate100} past $1.6M.`}
          />
        </Figure>

        <Figure
          layout="right"
          title="More meetings, sharper calls"
          lead="I hid 5 meetings and let the model learn from 3, 5, 7 and so on of the rest, 100 times over. Each time, I showed it a deck I backed and one I passed from the hidden meetings and checked which it scored higher."
          takeaway="It learned fast: with just 3 meetings it already beats simply adding up the six star ratings. Each extra meeting still helps, a little at a time."
          label="Line chart: picks the deck I backed rises from about 80% after 3 meetings to about 86% after 17, against a flat 75% for adding up the stars."
        >
          <LearningCurve />
        </Figure>
      </Section>

      <aside className="border-t border-ink/10 pt-14 sm:pt-20">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">This is the short version</h2>
          <p className="text-lg leading-relaxed text-muted">
            Everything on this page is simplified so it&apos;s easy to follow. Behind it there&apos;s a lot more:
            cleaning up the data, trying and comparing many different settings, and checks that never made it
            onto a chart. Think of it as a glimpse of how the model works, not the whole story.
          </p>
        </div>
      </aside>

      <details className="group rounded-3xl border border-ink/10 bg-white/50 p-6 backdrop-blur sm:p-8">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
          For the curious: the technical version
          <span className="text-muted transition-transform group-open:rotate-45">+</span>
        </summary>
        <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted">
          <li>
            <span className="font-medium text-ink">Model.</span> Gradient-boosted decision trees (scikit-learn{" "}
            <code className="font-mono text-[0.85em]">HistGradientBoostingRegressor</code>): {RECIPE.trees} trees,{" "}
            {RECIPE.leaves} leaves each, learning rate {RECIPE.learningRate}, fit with squared error on the 0/1
            invest label, so the output reads as an estimated invest rate. Inputs are the six star ratings and
            funding raised.
          </li>
          <li>
            <span className="font-medium text-ink">Constraints and weights.</span> Monotone increasing in all six
            ratings; funding is unconstrained. Sample weights decay with a half-life of{" "}
            {RECIPE.halfLifeSessions} meetings, so the oldest counts {fixed(RECIPE.oldestVsNewest, 2)}× the newest.
          </li>
          <li>
            <span className="font-medium text-ink">Evaluation.</span> Session-grouped nested cross-validation,{" "}
            {HELD_OUT.repeats} × {HELD_OUT.folds}-fold, with hyperparameters and the gate re-chosen inside every
            outer fold. Accuracy {(HELD_OUT.accuracy * 100).toFixed(1)}%, recall {pct(HELD_OUT.recall)}, precision{" "}
            {pct(HELD_OUT.precision)}. ROC AUC {fixed(HELD_OUT.rocAuc)} ± {fixed(HELD_OUT.rocAucSd)}, against{" "}
            {fixed(HELD_OUT.starSumRocAuc)} for the sum of the star ratings. Brier score {fixed(HELD_OUT.brier)},
            against {fixed(HELD_OUT.priorBrier)} for predicting the base rate.
          </li>
          <li>
            <span className="font-medium text-ink">Forward chaining.</span> Each of the newest {FUTURE.sessions}{" "}
            meetings scored by a model trained only on earlier ones: accuracy{" "}
            {(FUTURE.accuracy * 100).toFixed(1)}%, ROC AUC {fixed(FUTURE.rocAuc)}.
          </li>
          <li>
            <span className="font-medium text-ink">Gate.</span> {fixed(GATE)}, the score above which the model
            invests in the same share of held-out decks as the training labels did.
          </li>
          <li>
            <span className="font-medium text-ink">Replay.</span> Staged predictions after each of the{" "}
            {RECIPE.trees} trees for synthetic decks: value proposition and funding varied, the other ratings at
            their training medians.
          </li>
          <li>
            <span className="font-medium text-ink">Learning curve.</span> Hold out 5 random meetings, train on k of
            the rest, measure ROC AUC on the held-out five; 100 repeats per k.
          </li>
          <li>
            <span className="font-medium text-ink">In the app.</span> Exported to ONNX and run in-process, so every
            verdict on SevenFold comes from exactly this model.
          </li>
        </ul>
      </details>

      <div>
        <Link
          href={ROUTES.dashboard}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 font-semibold text-paper transition-colors hover:bg-accent"
        >
          Analyze your deck →
        </Link>
      </div>
    </div>
  );
}
