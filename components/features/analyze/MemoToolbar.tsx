"use client";

import type { AnalysisState } from "@/lib/diligence/stream-state";
import MemoExportButton from "./MemoExportButton";
import type { SaveStatus } from "./ReportProvider";

/** The memo's header controls: where its edits stand, and the PDF download. */
export default function MemoToolbar({ state, saveStatus }: { state: AnalysisState; saveStatus?: SaveStatus }) {
  return (
    <>
      <span aria-live="polite" className="text-xs">
        {saveStatus?.kind === "saving" && <span className="text-muted">Saving…</span>}
        {saveStatus?.kind === "saved" && <span className="text-accent">Saved</span>}
        {saveStatus?.kind === "error" && <span className="text-red-700">{saveStatus.message}</span>}
      </span>
      <MemoExportButton state={state} />
    </>
  );
}
