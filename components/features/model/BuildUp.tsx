import ScoreGrid from "@/components/features/model/ScoreGrid";
import { BUILD_UP } from "@/lib/invest/results";

/**
 * The value proposition × competitive advantage grid after 1, 10 and 100
 * rules (trees), on one colour scale. The printed range is what grows: almost
 * flat after one rule, the invest zone appearing by ten, the full spread at
 * 100.
 */
function range(grid: number[][]) {
  const all = grid.flat();
  return `${Math.round(Math.min(...all) * 100)}–${Math.round(Math.max(...all) * 100)}`;
}

export default function BuildUp() {
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 sm:gap-6">
        {BUILD_UP.map((step) => (
          <div key={step.trees}>
            <ScoreGrid grid={step.grid} size="sm" />
            <p className="mt-2.5 text-sm font-semibold text-ink">
              After {step.trees} {step.trees === 1 ? "rule" : "rules"}
            </p>
            <p className="text-xs tabular-nums text-muted">Scores {range(step.grid)}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">
        Same grid as above: value proposition up, competitive advantage across.
      </p>
    </div>
  );
}
