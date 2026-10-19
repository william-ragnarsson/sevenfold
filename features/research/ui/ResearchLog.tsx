"use client";

import { useEffect, useRef } from "react";
import Card from "@/components/ui/Card";
import { SearchList } from "@/components/report/Sources";
import type { AnalysisState } from "@/lib/diligence/stream-state";

/**
 * The live model scratchpad: the running prose notes the model writes while
 * researching. Its own card so it reads as a distinct chapter from the raw
 * search/source list.
 */
export function ResearchFindings({ state, active }: { state: AnalysisState; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const notes = state.notes;

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [notes]);

  return (
    <Card eyebrow="Research Findings">
      {notes ? (
        <div
          ref={ref}
          className="max-h-48 overflow-y-auto px-5 pb-4 font-mono text-xs leading-relaxed text-ink/70"
        >
          <span className="whitespace-pre-wrap">{notes}</span>
          {active && <span className="ml-0.5 inline-block w-1.5 animate-blink">▌</span>}
        </div>
      ) : (
        <div className="px-5 pb-4">
          <div className="h-3 w-32 animate-pulse rounded bg-ink/10" />
        </div>
      )}
    </Card>
  );
}

/**
 * The web-search rail card: a height-capped, auto-following list of every
 * search query and the sources it surfaced. This is the only place sources
 * render — the scorecard used to duplicate them.
 */
export function WebSearch({ state }: { state: AnalysisState }) {
  return (
    <Card eyebrow="Web Search">
      {state.searches.length > 0 ? (
        <div className="space-y-4 px-5 pb-4">
          <div className="flex items-center gap-3 text-xs text-muted">
            <span><span className="font-semibold text-ink">{state.searches.length}</span> searches</span>
            <span className="text-ink/20">•</span>
            <span><span className="font-semibold text-ink">{state.sourceCount}</span> sources</span>
          </div>
          <SearchList searches={state.searches} sourceCount={state.sourceCount} />
        </div>
      ) : (
        <div className="px-5 pb-4">
          <div className="h-3 w-32 animate-pulse rounded bg-ink/10" />
        </div>
      )}
    </Card>
  );
}
