"use client";

import Link from "next/link";
import type { AnalysisState } from "@/lib/diligence/stream-state";
import { useReport } from "./ReportProvider";
import RunLog, { CHAPTERS, chapterStatus, type ChapterStatus } from "./RunLog";
import VerdictLine from "./VerdictLine";
import { formatElapsed, useElapsed } from "./elapsed";
import { analysisPath } from "@/lib/routes";
import { PRODUCT_PAGES } from "@/lib/products";

/**
 * An analysis from the top: the company, the call once there is one, and the
 * run as a log, one stage after another, live while it goes. The log only
 * glimpses what each stage found; every line opens the page that has it all.
 */
export default function AnalysisOverview() {
  const report = useReport();
  // The frame shows the loading and missing states.
  if (!report?.state) return null;
  const { id, name, state, active, failure } = report;
  const stopped = !active && failure !== null;
  const description = state.form.company.description.value;
  const statuses = CHAPTERS.map((chapter) => chapterStatus(chapter, state, active, stopped));
  const date = state.startedAt
    ? new Date(state.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="mx-auto max-w-[680px] pb-16">
      <header className="mb-8 border-b border-ink/10 pt-2 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight break-words text-ink">{name}</h1>
        {description ? (
          <p className="mt-1 text-[15px] leading-relaxed text-muted">{description}</p>
        ) : active ? (
          <span className="mt-2 block h-3.5 w-64 max-w-full animate-pulse rounded bg-ink/10" />
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
          {state.verdict && (
            <Link href={`${analysisPath(id, "results")}#verdict`} className="group">
              <VerdictLine verdict={state.verdict} />
            </Link>
          )}
          <RunStatus state={state} active={active} stopped={stopped} statuses={statuses} date={date} />
        </div>
      </header>

      <RunLog id={id} state={state} statuses={statuses} />

      {!active && (
        <section className="pl-9">
          <p className="text-[15px] font-semibold text-ink">
            {stopped ? "The run stopped partway" : "Report ready"}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/70">
            {PRODUCT_PAGES.map(({ slug, label }) => (
              <Link
                key={slug}
                href={analysisPath(id, slug)}
                className="underline decoration-ink/20 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
              >
                {label}
              </Link>
            ))}
          </p>
        </section>
      )}
    </div>
  );
}

/** What the run is doing right now, and how long it has taken. */
function RunStatus({
  state,
  active,
  stopped,
  statuses,
  date,
}: {
  state: AnalysisState;
  active: boolean;
  stopped: boolean;
  statuses: ChapterStatus[];
  date: string | null;
}) {
  const elapsed = useElapsed(state.startedAt, active);
  const working = CHAPTERS.filter((_, i) => statuses[i] === "working").map((c) => c.title);
  const timings = Object.values(state.stages ?? {});
  // Between the last stage and the saved report, nothing is working but the run isn't over.
  const idle = timings.some((t) => t.end !== undefined) ? "Finishing" : "Starting";
  const now = active ? (working.length ? working.join(", ") : idle) : stopped ? "Stopped" : "Done";
  // A finished run's length is its last stage's end. A stopped one's isn't known,
  // and reports from before stages were tracked have none.
  const took = active ? elapsed : stopped ? 0 : Math.max(0, ...timings.map((t) => t.end ?? 0));
  const time = took > 0 ? formatElapsed(took) : null;

  return (
    <p className="text-muted tabular-nums">
      <span aria-live="polite" className={active ? "text-accent" : stopped ? "text-red-700" : "text-ink/70"}>
        {now}
      </span>
      {time && (active ? ` · ${time}` : ` in ${time}`)}
      {!active && date && ` · ${date}`}
    </p>
  );
}
