import type { InvestVerdict } from "../types";

/** The model's score on the 0–1 scale, from either generation of the model. */
export function verdictScore(verdict: InvestVerdict | null | undefined): number | null {
  if (!verdict?.available) return null;
  return verdict.score ?? verdict.probability ?? null;
}

/**
 * The call as a small pill, for lists of analyses: Invest or Pass and the
 * score out of 100. Nothing before the call is made, or when the model
 * couldn't run.
 */
export default function VerdictBadge({ verdict }: { verdict: InvestVerdict | null | undefined }) {
  if (!verdict?.available) return null;
  const score = verdictScore(verdict);
  return (
    <span
      className={
        "inline-flex shrink-0 items-baseline gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold " +
        (verdict.invest ? "bg-accent/10 text-accent" : "bg-red-500/10 text-red-700")
      }
    >
      {verdict.invest ? "Invest" : "Pass"}
      {score !== null && <span className="font-normal tabular-nums opacity-75">{Math.round(score * 100)}</span>}
    </span>
  );
}
