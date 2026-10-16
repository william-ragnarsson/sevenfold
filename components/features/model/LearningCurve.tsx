import { LEARNING } from "@/lib/invest/results";

/**
 * Ranking score against the number of meetings the model learned from, with
 * adding-up-the-stars as the flat line to beat. The SVG viewBox is 160 × 100
 * and the box is 16:10, so nothing stretches; the line strokes are
 * non-scaling so they stay crisp at phone width. Tick labels are HTML.
 *
 * Y runs 70% → 90%. The model line wipes in left to right, as if drawn.
 */
const Y_TOP = 0.9;
const Y_SPAN = 0.2;
const TICKS = [0.7, 0.75, 0.8, 0.85, 0.9];

const first = LEARNING.curve[0].meetings;
const last = LEARNING.curve[LEARNING.curve.length - 1].meetings;
const x = (meetings: number) => 6 + ((meetings - first) / (last - first)) * 148;
const y = (auc: number) => ((Y_TOP - auc) / Y_SPAN) * 100;

export default function LearningCurve() {
  const points = LEARNING.curve.map((p) => ({ ...p, x: x(p.meetings), y: y(p.rocAuc) }));
  const starY = y(LEARNING.starSumRocAuc);
  const end = points[points.length - 1];

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Picks the deck I backed</p>

      <div className="mt-4 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2">
        <div className="relative">
          {TICKS.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-[11px] tabular-nums text-muted"
              style={{ top: `${y(t)}%` }}
            >
              {Math.round(t * 100)}%
            </span>
          ))}
        </div>

        <div className="relative aspect-[16/10]">
          <svg viewBox="0 0 160 100" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            {TICKS.map((t) => (
              <line
                key={t}
                x1="0"
                x2="160"
                y1={y(t)}
                y2={y(t)}
                stroke="currentColor"
                className="text-ink/10"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <line
              x1="0"
              x2="160"
              y1={starY}
              y2={starY}
              stroke="currentColor"
              className="text-ink/45"
              strokeWidth="2"
              strokeDasharray="5 5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="r-wipe absolute inset-0">
            <svg viewBox="0 0 160 100" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
              <polyline
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {points.map((p) => (
                <circle key={p.meetings} cx={p.x} cy={p.y} r="2" fill="var(--accent)" />
              ))}
            </svg>
          </div>

          <span
            className="absolute right-0 text-xs font-semibold text-accent"
            style={{ top: `calc(${end.y}% - 1.6rem)` }}
          >
            SevenFold&apos;s model
          </span>
          <span
            className="absolute right-0 text-xs font-medium text-muted"
            style={{ top: `calc(${starY}% - 1.4rem)` }}
          >
            Adding up the stars
          </span>
        </div>

        <span />
        <div className="relative mt-2 h-4">
          {points.map((p) => (
            <span
              key={p.meetings}
              className="absolute -translate-x-1/2 text-[11px] tabular-nums text-muted"
              style={{ left: `${(p.x / 160) * 100}%` }}
            >
              {p.meetings}
            </span>
          ))}
        </div>
        <span />
        <p className="mt-1 text-center text-xs font-medium text-muted">Meetings it learned from</p>
      </div>
    </div>
  );
}
