"use client";

import AnalysisLauncher from "@/components/features/analyze/AnalysisLauncher";
import RecentAnalyses from "@/components/features/analyze/RecentAnalyses";
import { useAnalysis } from "@/components/features/analyze/AnalysisProvider";
import LegacyImportPrompt from "@/components/features/auth/LegacyImportPrompt";

/**
 * The analysis workspace used by /dashboard/due-diligence: the labelled upload + run
 * controls with saved analyses below. (The home page hoists the launcher into
 * the hero card instead and renders RecentAnalyses on its own.)
 *
 * The sample-deck escape hatch comes with `AnalysisLauncher`, so every dropzone
 * on the site offers the same way out for someone who turns up without a PDF.
 */
export default function AnalysisWorkspace() {
  const { status, refreshHistory } = useAnalysis();

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            {status === "loading" ? "In progress" : "Try it"}
          </span>
          <span className="h-px flex-1 bg-ink/10" />
        </div>

        <AnalysisLauncher />
      </section>

      <LegacyImportPrompt onImported={() => void refreshHistory()} />

      <RecentAnalyses />
    </div>
  );
}
