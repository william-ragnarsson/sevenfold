import { delay } from "@/components/features/model/motion";
import { DATA, FUTURE, pct } from "@/lib/invest/results";

/**
 * The forward-chaining test as a strip of meetings in date order: the earlier
 * ones only ever learned from, the newest ones each scored by a model trained
 * on everything before it. No dates, just the order.
 */
export default function FutureTest() {
  const earlier = DATA.sessions - FUTURE.sessions;
  const cols = { gridTemplateColumns: `repeat(${DATA.sessions}, minmax(0, 1fr))` };

  return (
    <div>
      <div className="grid gap-[3px]" style={cols}>
        {Array.from({ length: DATA.sessions }, (_, i) =>
          i < earlier ? (
            <span key={i} className="h-8 rounded-[3px] bg-ink/15" />
          ) : (
            <span key={i} className="r-pop h-8 rounded-[3px] bg-accent" style={delay((i - earlier) * 110)} />
          ),
        )}
      </div>
      <div className="mt-2 grid gap-[3px] text-xs leading-snug" style={cols}>
        <span className="border-t border-ink/25 pt-1.5 text-muted" style={{ gridColumn: `span ${earlier}` }}>
          {earlier} earlier meetings
        </span>
        <span className="border-t border-accent pt-1.5 font-medium text-accent" style={{ gridColumn: `span ${FUTURE.sessions}` }}>
          Newest {FUTURE.sessions}, tested one at a time
        </span>
      </div>

      <dl className="mt-7 grid grid-cols-2 gap-5 border-t border-ink/10 pt-5">
        <div>
          <dt className="text-3xl font-bold tabular-nums tracking-tight text-ink">{pct(FUTURE.accuracy)}</dt>
          <dd className="mt-1 text-sm text-muted">same call as me, on {FUTURE.rows} decks</dd>
        </div>
        <div>
          <dt className="text-3xl font-bold tabular-nums tracking-tight text-ink">
            {FUTURE.caught}
            <span className="text-lg font-semibold text-muted"> of {FUTURE.invest}</span>
          </dt>
          <dd className="mt-1 text-sm text-muted">decks I backed, caught</dd>
        </div>
      </dl>
    </div>
  );
}
