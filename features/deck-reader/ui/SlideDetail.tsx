"use client";

import { MAX_SLIDE_CHARS } from "@/features/deck-reader/state";
import type { SlideStatus, SlideView } from "./selectors";

const NOT_READ: Partial<Record<SlideStatus, string>> = {
  pending: "Not read yet.",
  reading: "Reading this slide…",
  blank: "Nothing new was transcribed from this page.",
};

function Heading({ children }: { children: string }) {
  return <h3 className="mb-2 text-xs font-medium text-muted">{children}</h3>;
}

/**
 * What the reader took off one slide and the form fields the model says came
 * from it, side by side when there's room. This is the place to check what the
 * AI actually saw when a field looks wrong. Every field listed is a deck value
 * (`findingsBySlide`), so none carries a source badge. Remount it (via `key`)
 * per slide, so a highlight replays.
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
    <div className="@container">
      <div className="grid gap-6 @xl:grid-cols-2">
        <div className="min-w-0">
          <Heading>What it read</Heading>
          {view.text ? (
            <>
              <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink/70">
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
            <dl className="space-y-3 text-sm">
              {view.findings.map((f) => (
                <div key={f.key}>
                  <dt className="text-xs text-muted">
                    <span className={f.key === highlight ? "cell-pop" : undefined}>{f.label}</span>
                  </dt>
                  <dd className="mt-0.5 line-clamp-6 leading-relaxed text-ink/80">{f.value}</dd>
                </div>
              ))}
            </dl>
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
    </div>
  );
}
