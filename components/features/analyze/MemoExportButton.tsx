"use client";

import { useState } from "react";
import type { AnalysisState } from "@/lib/diligence/stream-state";

/** `acme-inc-memo.pdf`, from the company's name. */
function fileName(state: AnalysisState): string {
  const slug = state.form.company.name.value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return `${slug || "deck"}-memo.pdf`;
}

/**
 * Downloads the memo as a PDF, made in the browser: no server, no model call.
 * The PDF library is a few hundred kB, so it's only fetched on the first click.
 */
export default function MemoExportButton({ state }: { state: AnalysisState }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const download = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const [{ pdf }, { default: MemoPdf }] = await Promise.all([import("@react-pdf/renderer"), import("./MemoPdf")]);
      const blob = await pdf(<MemoPdf state={state} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName(state);
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Some browsers start the download after the click returns.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      console.warn("[memo] PDF export failed:", err);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {failed && <span className="text-xs text-red-700">Couldn&apos;t make the PDF.</span>}
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-paper px-3 py-1 text-xs font-medium text-ink transition-colors hover:bg-ink/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M8 2.5v7.5M4.75 7 8 10.25 11.25 7M3 13.25h10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {busy ? "Making PDF…" : "Download PDF"}
      </button>
    </>
  );
}
