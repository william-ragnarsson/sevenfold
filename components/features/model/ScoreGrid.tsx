import { delay } from "@/components/features/model/motion";
import { GATE } from "@/lib/invest/results";

/**
 * A 5×5 grid of scores: value proposition 5 on the top row down to 1, and
 * competitive advantage 1 → 5 left to right. `grid` comes in as rows VP 1 → 5
 * (see results.ts), so it is flipped here.
 *
 * Shade is the score itself, mixed from paper to accent on one fixed scale, so
 * the three small grids in BuildUp compare directly with the big one. Only the
 * big grid prints numbers and rings the cells at or over the gate.
 */
export default function ScoreGrid({ grid, size = "lg" }: { grid: number[][]; size?: "lg" | "sm" }) {
  const lg = size === "lg";
  const rows = grid.map((cells, i) => ({ vp: i + 1, cells })).reverse();

  return (
    <div className={"grid grid-cols-5 " + (lg ? "gap-1.5" : "gap-0.5")}>
      {rows.flatMap(({ vp, cells }, r) =>
        cells.map((s, c) => (
          <span
            key={`${vp}-${c}`}
            className={
              "r-pop grid aspect-square place-items-center font-semibold tabular-nums ring-inset " +
              (lg ? "rounded-lg text-xs sm:text-sm " : "rounded-[3px] ") +
              (s >= 0.5 ? "text-white " : "text-ink/70 ") +
              // Every other cell gets a hairline, so near-zero cells (almost
              // paper) don't read as gaps in the grid.
              (lg && s >= GATE ? "ring-2 ring-marker" : "ring-1 ring-ink/[0.07]")
            }
            style={{
              ...delay((r + c) * 45),
              backgroundColor: `color-mix(in oklab, var(--accent) ${Math.round(s * 100)}%, var(--paper))`,
            }}
          >
            {lg ? Math.round(s * 100) : null}
          </span>
        )),
      )}
    </div>
  );
}
