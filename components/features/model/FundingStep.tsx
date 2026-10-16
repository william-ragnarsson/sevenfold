import { delay } from "@/components/features/model/motion";
import { FUNDING } from "@/lib/invest/results";

/**
 * Every training deck re-scored as if it had raised a set amount: how many in
 * 100 would then clear the gate. A sample of the amounts in the card, enough
 * to show the flat run, the cliff between $1.6M and $1.7M, and the floor.
 *
 * Bars are on the full 0–100 scale, so "about half" looks like half.
 */
const SHOWN = [0, 250_000, 500_000, 1_000_000, 1_600_000, 1_700_000, 3_000_000, 10_000_000, 50_000_000];
const CLIFF = 1_700_000;

const fmtUsd = (usd: number) =>
  usd === 0 ? "$0" : usd < 1_000_000 ? `$${usd / 1000}K` : `$${usd / 1_000_000}M`;

function Row({ label, share, bar, i }: { label: string; share: number; bar: string; i: number }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_1.75rem] items-center gap-3 text-sm">
      <span className="text-muted tabular-nums">{label}</span>
      <div className="h-2.5 rounded-full bg-ink/[0.05]">
        <div className={"r-grow-x h-full rounded-full " + bar} style={{ ...delay(i * 70), width: `${share * 100}%` }} />
      </div>
      <span className="text-right font-semibold tabular-nums text-ink">{Math.round(share * 100)}</span>
    </div>
  );
}

export default function FundingStep() {
  const at = (usd: number | null) => FUNDING.find((f) => f.usd === usd)?.investShare ?? 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 text-xs font-medium uppercase tracking-[0.16em] text-muted">
        <span>Raised</span>
        <span>Invest calls per 100</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {SHOWN.map((usd, i) => (
          <div key={usd}>
            {usd === CLIFF && (
              <p className="mb-2.5 border-t border-dashed border-red-600/40 pt-1.5 text-xs font-medium text-red-700/80">
                Past about $1.6M raised
              </p>
            )}
            <Row label={fmtUsd(usd)} share={at(usd)} bar={usd < CLIFF ? "bg-accent" : "bg-ink/25"} i={i} />
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-ink/10 pt-4">
        <Row label="Not stated" share={at(null)} bar="bg-ink/40" i={SHOWN.length} />
      </div>
    </div>
  );
}
