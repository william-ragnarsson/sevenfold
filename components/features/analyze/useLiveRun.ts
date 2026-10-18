"use client";

import { analysisPath } from "@/lib/routes";
import { useAnalysis } from "./AnalysisProvider";

/**
 * The run going on in this tab, summed up for the places that point back to
 * it while you're elsewhere: the public nav's pill and the dashboard
 * sidebar. Null when nothing is running.
 */
export function useLiveRun() {
  const { status, stream, currentId, file } = useAnalysis();
  if (status !== "loading" || !currentId) return null;

  const activeIndex = stream.steps.findIndex((s) => s.status === "active");
  return {
    href: analysisPath(currentId),
    name: stream.form.company.name.value || file?.name || "Analysing deck",
    label: activeIndex === -1 ? "Working" : stream.steps[activeIndex].label,
    // 1-indexed "current step" (not a count of completed steps), so progress
    // reads 1/5 → 5/5, matching CurrentAnalysisCard.
    step: activeIndex === -1 ? stream.steps.length : activeIndex + 1,
    steps: stream.steps.length,
  };
}

export type LiveRun = NonNullable<ReturnType<typeof useLiveRun>>;
