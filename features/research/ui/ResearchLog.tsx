"use client";

import Card from "@/components/ui/Card";
import { SearchList } from "@/components/report/Sources";
import type { AnalysisState } from "@/lib/diligence/stream-state";

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The notes are loose markdown (`## ` headings, `**bold**`, `---` rules). Just
 * enough of it is drawn to read as prose rather than raw model output.
 */
function NoteLines({ notes }: { notes: string }) {
  return notes.split("\n").map((line, i) => {
    if (!line.trim() || /^\s*([-*_])\1{2,}\s*$/.test(line)) return null;
    const text = line.replace(/\*\*/g, "");
    const heading = /^#{1,6}\s+(.*)$/.exec(text);
    return heading ? (
      <p key={i} className="pt-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink first:pt-0">
        {heading[1]}
      </p>
    ) : (
      <p key={i}>{text}</p>
    );
  });
}

/**
 * Where the memo's web answers came from: every search the research ran, the
 * sources each one surfaced, and the notes it wrote up (closed by default).
 * Shown under the memo rather than on a page of its own, as wide as the memo.
 * Landscape lists its own searches on its page.
 */
export function ResearchSources({ state, active }: { state: AnalysisState; active: boolean }) {
  const { searches, sourceCount, notes } = state;
  const counts =
    searches.length > 0 ? (
      <span className="text-xs text-muted">
        {plural(searches.length, "search", "searches")} · {plural(sourceCount, "source")}
      </span>
    ) : null;

  return (
    <Card eyebrow="Sources" actions={counts} className="max-w-4xl">
      <p className="px-5 pb-3 text-sm text-muted">
        What the research searched for to fill the memo&rsquo;s gaps, and what each search turned up.
      </p>
      <div className="px-5 pb-4">
        {searches.length > 0 ? (
          <SearchList searches={searches} sourceCount={sourceCount} />
        ) : active ? (
          <div className="h-3 w-32 animate-pulse rounded bg-ink/10" />
        ) : (
          <p className="text-sm text-muted">No web searches ran.</p>
        )}
      </div>
      {notes && (
        <details className="group border-t border-ink/10">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium text-ink/80 hover:text-ink [&::-webkit-details-marker]:hidden">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
            Research notes
          </summary>
          <div className="space-y-1.5 px-5 pb-5 text-sm leading-relaxed text-ink/80">
            <NoteLines notes={notes} />
            {active && <span className="inline-block w-1.5 animate-blink">▌</span>}
          </div>
        </details>
      )}
    </Card>
  );
}
