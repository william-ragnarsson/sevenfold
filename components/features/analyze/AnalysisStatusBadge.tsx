import VerdictBadge from "@/features/verdict/ui/VerdictBadge";
import type { AnalysisSummary } from "@/lib/analyses/store";
import { isStalled } from "@/lib/analyses/status";

const PILL = "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium";

/**
 * Where a saved analysis stands, as a small pill: Failed, Unfinished (marked
 * running but long dead) or Running, else the verdict once it's in.
 */
export default function AnalysisStatusBadge({
  record,
}: {
  record: Pick<AnalysisSummary, "status" | "startedAt" | "verdict">;
}) {
  if (record.status === "error") return <span className={`${PILL} bg-red-500/10 text-red-700`}>Failed</span>;
  if (record.status === "running") {
    return isStalled(record.status, record.startedAt) ? (
      <span className={`${PILL} bg-red-500/10 text-red-700`}>Unfinished</span>
    ) : (
      <span className={`${PILL} bg-amber-500/10 text-amber-700`}>Running</span>
    );
  }
  return <VerdictBadge verdict={record.verdict} />;
}
