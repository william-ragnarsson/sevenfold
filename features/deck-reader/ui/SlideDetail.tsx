"use client";

import { SourceBadge } from "@/components/report/SourceBadge";
import { MAX_SLIDE_CHARS } from "@/features/deck-reader/state";
import type { SlideStatus, SlideView } from "./selectors";

const NOT_READ: Partial<Record<SlideStatus, string>> = {
  pending: "Not read yet.",
  reading: "Reading this slide…",
  blank: "Nothing new was transcribed from this page.",
};

function Heading({ children }: { children: string }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/40">{children}</p>;
}

/**
 * What the reader took off one slide and the form fields the model says came
 * from it. This is the place to check what the AI actually saw when a field
 * looks wrong. Remount it (via `key`) per slide, so a highlight replays.
 */
export default function SlideDetail({
  view,
  active,
  highlight,
}: {
  view: SlideView;
  /** The run is still going, so more fields may land on this slide. */
  active: boolean;
  /** Key of a field just found here, to flash it. */
  highlight: string | null;
}) {
  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <Heading>What it read</Heading>
        {view.text ? (
          <>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-paper-2/60 p-3 font-mono text-xs leading-relaxed text-ink/80">
              {view.text}
            </pre>
            {view.truncated && (
              <p className="mt-1.5 text-xs text-muted">
                Cut at {MAX_SLIDE_CHARS.toLocaleString("en-US")} characters here. The model read all of it.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">{NOT_READ[view.status] ?? "No text."}</p>
        )}
      </div>

      <div className="min-w-0">
        <Heading>What it extracted</Heading>
        {view.findings.length > 0 ? (
          <ul className="space-y-3">
            {view.findings.map((f) => (
              <li key={f.key} className="text-sm">
                <span className={`font-semibold text-ink ${f.key === highlight ? "cell-pop" : ""}`}>{f.label}</span>
                <SourceBadge source={f.source} />
                <p className="mt-0.5 line-clamp-4 leading-relaxed text-ink/70">{f.value}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            {view.status === "pending" || view.status === "reading"
              ? "Nothing yet."
              : active
                ? "No fields cite this slide yet."
                : "No fields cite this slide."}
          </p>
        )}
      </div>
    </div>
  );
}
