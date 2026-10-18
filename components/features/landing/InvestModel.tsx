import Link from "next/link";
import DealLog from "@/components/features/landing/DealLog";
import { DATA, HELD_OUT, pct } from "@/lib/invest/results";
import { ROUTES } from "@/lib/routes";

/**
 * The credibility section, and the first thing under the hero: where the
 * training data came from, and how often the model agrees with me.
 *
 * It argues one thing — the dataset is real, it's mine, and it isn't public —
 * so the layout puts the claim and the evidence side by side rather than
 * explaining a pipeline. It is also the way in to /model, which has the charts.
 *
 * The figures are load-bearing rather than round. The accuracy is the
 * conservative one, on whole meetings the model never saw (session-grouped
 * nested CV), and its caveats — most decks are passes, so "always pass" scores
 * 74% too — live on /model next to the ranking test that answers them. 765 is
 * the decisions it learned from, not the decks reviewed; 7 is the width of the
 * feature vector in `lib/invest/model.ts`.
 */
const FIGURES = [
  { value: pct(HELD_OUT.accuracy), label: "Same call as me", note: "On meetings the model never saw while learning." },
  { value: String(DATA.rows), label: "Real invest-or-pass calls", note: "Each one a real decision. Nothing scraped." },
  { value: "7", label: "Signals scored per deck", note: "The model's whole input. Nothing else reaches it." },
];

export default function InvestModel() {
  return (
    <section className="fade-up">
      {/* Sheet first in the DOM, so the single-column stack on phones leads with
          the evidence rather than making you scroll past three figures to reach
          the thing they describe. */}
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
        <DealLog />

        <div>
          <h2 className="text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-4xl">
            Trained on{" "}
            <span className="font-serif font-normal italic">proprietary data.</span>
          </h2>

          <p className="mt-6 text-lg leading-relaxed text-muted">
            A year of weekly partner meetings and deal reviews at Plug and Play Tech Center. Every
            deck I read ended in a real invest-or-pass call. That record, not a public dataset, is
            what the model learned from.
          </p>

          {/* A stacked list rather than three across: the column is too narrow
              for that, and the fixed-width numeral gutter lines the values up
              into a spec table, which is the register this section wants. */}
          <dl className="mt-10 divide-y divide-ink/10 border-t border-ink/12">
            {FIGURES.map((f) => (
              <div key={f.label} className="flex items-baseline gap-5 py-4">
                <dt className="w-20 shrink-0 text-3xl font-bold tabular-nums tracking-tight text-ink">
                  {f.value}
                </dt>
                <dd className="min-w-0 text-sm leading-relaxed text-muted">
                  <span className="font-medium text-ink/80">{f.label}</span>
                  <br />
                  {f.note}
                </dd>
              </div>
            ))}
          </dl>

          <Link
            href={ROUTES.model}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/50 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent/40 hover:text-accent"
          >
            See how it was trained and tested →
          </Link>
        </div>
      </div>
    </section>
  );
}
