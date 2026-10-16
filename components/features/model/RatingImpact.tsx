import { delay } from "@/components/features/model/motion";
import { ONE_STAR_MORE } from "@/lib/invest/results";

/**
 * One star more on one rating, everything else unchanged: how far the 0–100
 * score moves on average, and how often that flips the verdict. Averaged over
 * the training decks that had room to go up a star.
 *
 * The top two are in accent because they are the finding; the rest are there
 * to show how small they are by comparison.
 */
const fmtPoints = (p: number) => (p < 0.5 ? "≈ 0" : p < 2 ? `+${p.toFixed(1)}` : `+${Math.round(p)}`);

function fmtFlips(per100: number) {
  if (per100 === 0) return "never changes the verdict";
  if (per100 < 0.5) return "almost never changes the verdict";
  return `changes the verdict for ${Math.round(per100)} in 100 decks`;
}

export default function RatingImpact() {
  const max = ONE_STAR_MORE[0].points;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Score change for one more star</p>
      <ul className="mt-5 space-y-4">
        {ONE_STAR_MORE.map((r, i) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={i < 2 ? "font-semibold text-ink" : "text-ink/80"}>{r.label}</span>
              <span className="font-semibold tabular-nums text-ink">
                {fmtPoints(r.points)} <span className="text-xs font-normal text-muted">points</span>
              </span>
            </div>
            <div className="mt-1.5 h-2.5 rounded-full bg-ink/[0.05]">
              <div
                className={"r-grow-x h-full rounded-full " + (i < 2 ? "bg-accent" : "bg-ink/25")}
                style={{ ...delay(i * 110), width: `${(r.points / max) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted">{fmtFlips(r.flippedPer100)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
