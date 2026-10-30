import type { InvestVerdict } from "@/lib/diligence/types";
import { formatGauge } from "@/lib/invest/gauge";

/**
 * The call in a line: Invest or Pass, then the score against the gate. The
 * Results page has the meter and what the model read. Inside a `group` link,
 * the call underlines on hover.
 */
export default function VerdictLine({ verdict }: { verdict: InvestVerdict }) {
  if (!verdict.available)
    return <span className="text-muted transition-colors group-hover:text-ink">No verdict: the model couldn’t run</span>;
  const gauge =
    verdict.score !== undefined && verdict.threshold !== undefined
      ? formatGauge(verdict.score, verdict.threshold)
      : null;
  // Reports saved before the regression model only carry a probability.
  const detail = gauge
    ? `score ${gauge.score} · gate ${gauge.gate}`
    : verdict.probability !== undefined
      ? `${Math.round(verdict.probability * 100)}% likely to invest`
      : null;
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className={`h-2 w-2 rounded-full ${verdict.invest ? "bg-accent" : "bg-red-600"}`} />
      <span className="font-semibold text-ink group-hover:underline">{verdict.invest ? "Invest" : "Pass"}</span>
      {detail && <span className="text-muted tabular-nums">{detail}</span>}
    </span>
  );
}
