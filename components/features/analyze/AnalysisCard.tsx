"use client";

import Link from "next/link";
import { useMemo } from "react";
import DeckCover from "@/features/deck-reader/ui/DeckCover";
import type { AnalysisSummary } from "@/lib/analyses/store";
import { analysisPath } from "@/lib/routes";
import AnalysisStatusBadge from "./AnalysisStatusBadge";
import DeleteAnalysisButton from "./DeleteAnalysisButton";
import { coverPageOf, savedDeckSource } from "./deckSource";
import { relativeTime } from "./elapsed";

/**
 * A saved analysis as a card: its deck's cover, then the name, when it ran and
 * where it stands. Runs with no stored PDF (from Claude, or imported) show the
 * name's initial instead of a cover. `onDelete` adds a trash button over the
 * cover, shown on hover where there's a mouse and always on touch screens.
 */
export default function AnalysisCard({ record, onDelete }: { record: AnalysisSummary; onDelete?: () => void }) {
  const name = record.name || "Untitled deck";
  const source = useMemo(() => savedDeckSource(record.id, record.deckPath), [record.id, record.deckPath]);

  return (
    <div className="group relative h-full">
      <Link
        href={analysisPath(record.id)}
        className="flex h-full flex-col overflow-hidden rounded-3xl border border-ink/12 bg-paper-2/50 backdrop-blur transition-colors hover:border-ink/25 hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <div className="relative aspect-video border-b border-ink/10 bg-ink/[0.04]">
          <DeckCover
            source={source}
            page={coverPageOf(record.id)}
            alt=""
            fallback={
              <span className="grid h-full w-full place-items-center font-serif text-5xl text-ink/20" aria-hidden>
                {name.charAt(0).toUpperCase()}
              </span>
            }
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 px-5 py-4">
          <p className="truncate font-semibold text-ink" title={name}>
            {name}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted">{relativeTime(record.generatedAt)}</span>
            <AnalysisStatusBadge record={record} />
          </div>
        </div>
      </Link>
      {onDelete && (
        <DeleteAnalysisButton
          name={name}
          onDelete={onDelete}
          tone="overlay"
          className="absolute right-3 top-3 focus-visible:opacity-100 group-focus-within:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
        />
      )}
    </div>
  );
}
