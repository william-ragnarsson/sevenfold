import { delay } from "@/components/features/model/motion";
import { AGREE_PER_100 as AGREE, PER_100 } from "@/lib/invest/results";

/**
 * 100 decks from meetings the model never saw, one dot each. Agreements first,
 * then the two kinds of disagreement, so the 83 / 17 split reads as two blocks
 * before anyone looks at the legend.
 */
const KINDS = [
  { key: "bothInvest", label: "We both said invest", dot: "bg-accent" },
  { key: "bothPass", label: "We both said pass", dot: "bg-ink/15" },
  { key: "missed", label: "I backed it, the model passed", dot: "bg-red-600/70" },
  { key: "falseAlarm", label: "The model said invest, I passed", dot: "ring-2 ring-inset ring-red-600/70" },
] as const;

export default function AgreementDots() {
  const dots = KINDS.flatMap((k) => Array.from({ length: PER_100[k.key] }, () => k.dot));

  return (
    <div className="grid items-center gap-7 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div className="mx-auto grid w-full max-w-[15rem] grid-cols-10 gap-1.5">
        {dots.map((cls, i) => (
          <span key={i} className={"r-pop aspect-square rounded-full " + cls} style={delay(i * 9)} />
        ))}
      </div>

      <div>
        <p className="text-sm text-muted">
          <span className="text-2xl font-bold tabular-nums text-ink">{AGREE}</span> same call ·{" "}
          <span className="text-2xl font-bold tabular-nums text-ink">{100 - AGREE}</span> different
        </p>
        <ul className="mt-4 space-y-2.5 text-sm">
          {KINDS.map((k) => (
            <li key={k.key} className="flex items-center gap-3">
              <span className={"h-3 w-3 shrink-0 rounded-full " + k.dot} />
              <span className="w-5 shrink-0 font-semibold tabular-nums text-ink">{PER_100[k.key]}</span>
              <span className="text-muted">{k.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
