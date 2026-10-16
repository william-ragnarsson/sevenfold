import { DATA } from "@/lib/invest/results";

/**
 * Every deck in the export as one bar: the calls the model learned from, and
 * the few it couldn't (no final call, or ratings missing). One wipe for the
 * whole bar, since the segments only mean something side by side.
 */
export default function DataSplit() {
  const left = DATA.reviewed - DATA.rows;
  const w = (n: number) => `${(n / DATA.reviewed) * 100}%`;
  const ITEMS = [
    { n: DATA.invest, label: "I backed", swatch: "bg-accent" },
    { n: DATA.pass, label: "I passed", swatch: "bg-ink/20" },
    { n: left, label: "Left out: no final call or missing ratings", swatch: "border border-dashed border-ink/30" },
  ];

  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-4xl font-bold tabular-nums tracking-tight text-ink">{DATA.rows}</span>
        <span className="text-sm text-muted">decisions it learned from, out of {DATA.reviewed} decks reviewed</span>
      </p>

      <div className="r-wipe mt-6 flex h-10 gap-[3px] overflow-hidden rounded-xl">
        <div className="bg-accent" style={{ width: w(DATA.invest) }} />
        <div className="bg-ink/20" style={{ width: w(DATA.pass) }} />
        <div className="rounded-r-xl border border-dashed border-ink/30" style={{ width: w(left) }} />
      </div>

      <ul className="mt-5 space-y-2 text-sm">
        {ITEMS.map((it) => (
          <li key={it.label} className="flex items-center gap-3">
            <span className={"h-3 w-3 shrink-0 rounded-[3px] " + it.swatch} />
            <span className="w-8 shrink-0 font-semibold tabular-nums text-ink">{it.n}</span>
            <span className="text-muted">{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
