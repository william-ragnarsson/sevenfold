import { delay } from "@/components/features/model/motion";
import { HELD_OUT, pct } from "@/lib/invest/results";

/**
 * The ranking test (ROC AUC, without the name): given one deck I backed and one
 * I passed, how often does each method put the backed one on top? The bars run
 * on the full 0–100 scale, so the coin flip really is half a track.
 */
const BARS = [
  { label: "SevenFold's model", value: HELD_OUT.rocAuc, bar: "bg-accent", strong: true },
  { label: "Adding up the six star ratings", value: HELD_OUT.starSumRocAuc, bar: "bg-ink/30", strong: false },
  { label: "Coin flip", value: 0.5, bar: "bg-ink/12", strong: false },
];

export default function RankingBars() {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Picks the deck I backed</p>
      <div className="mt-5 space-y-5">
        {BARS.map((b, i) => (
          <div key={b.label}>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className={b.strong ? "font-semibold text-ink" : "text-muted"}>{b.label}</span>
              <span className="font-semibold tabular-nums text-ink">{pct(b.value)}</span>
            </div>
            <div className="mt-2 h-3 rounded-full bg-ink/[0.05]">
              <div
                className={"r-grow-x h-full rounded-full " + b.bar}
                style={{ ...delay(i * 140), width: pct(b.value) }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
