import ScoreGrid from "@/components/features/model/ScoreGrid";
import { GATE, VP_X_CA } from "@/lib/invest/results";

const STARS = [1, 2, 3, 4, 5];

/** The two ratings that matter most, against each other, on the final model. */
export default function RatingHeatmap() {
  return (
    <div className="mx-auto max-w-sm">
      <p className="text-xs font-medium text-muted">↑ Value proposition (stars)</p>
      <div className="mt-2 grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2">
        <div className="flex flex-col justify-around text-center text-xs tabular-nums text-muted">
          {[...STARS].reverse().map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <ScoreGrid grid={VP_X_CA} />
        <span />
        <div className="mt-2 grid grid-cols-5 text-center text-xs tabular-nums text-muted">
          {STARS.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>
      <p className="mt-1 text-right text-xs font-medium text-muted">Competitive advantage (stars) →</p>

      <div className="mt-5 flex items-center gap-2.5 border-t border-ink/10 pt-4 text-xs text-muted">
        <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] bg-accent ring-2 ring-inset ring-marker" />
        Invest zone: a score of {Math.round(GATE * 100)} or more
      </div>
    </div>
  );
}
