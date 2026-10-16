import { delay } from "@/components/features/model/motion";
import { DATA, HELD_OUT } from "@/lib/invest/results";

/**
 * Grouped cross-validation as a picture: five rounds, one group of meetings
 * held back in each, the diagonal showing that every group gets its turn.
 */
export default function TestSchematic() {
  const groups = HELD_OUT.folds;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
        {DATA.sessions} meetings in {groups} groups
      </p>
      <div className="mt-4 space-y-1.5">
        {Array.from({ length: groups }, (_, round) => (
          <div key={round} className="grid grid-cols-[3.75rem_repeat(5,minmax(0,1fr))] items-center gap-1.5">
            <span className="text-xs text-muted">Round {round + 1}</span>
            {Array.from({ length: groups }, (_, g) =>
              g === round ? (
                <span
                  key={g}
                  className="r-pop grid h-7 place-items-center rounded-md bg-accent text-[11px] font-semibold text-white"
                  style={delay(round * 130)}
                >
                  test
                </span>
              ) : (
                <span key={g} className="h-7 rounded-md bg-ink/12" />
              ),
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink/10 pt-4 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[3px] bg-ink/12" /> Learns from
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[3px] bg-accent" /> Tested on, never seen
        </span>
        <span className="font-medium text-ink/80">
          × {HELD_OUT.repeats} reshuffles = {HELD_OUT.testCalls.toLocaleString("en-US")} test calls
        </span>
      </div>
    </div>
  );
}
