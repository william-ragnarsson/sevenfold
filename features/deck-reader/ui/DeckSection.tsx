"use client";

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import {
  buildSlideViews,
  citationTour,
  deckProgressLabel,
  deckTotal,
  deckViaLabel,
  findingsBySlide,
  isUnmapped,
  type SlideFinding,
  type SlideView,
} from "./selectors";
import type { DeckState } from "@/features/deck-reader/types";
import type { DueDiligenceForm } from "@/lib/diligence/types";
import type { PdfSource } from "@/lib/analyses/pdf-source";
import { sweepDwell, useDeckThumbnails, useNearViewport, usePacedReveal, useReducedMotion } from "./hooks";
import SlideReel from "./SlideReel";
import SlideDetail from "./SlideDetail";

/** How long the reel stays on each new find before going to the next, in ms. */
const FIND_DWELL = 1200;

const NO_FINDINGS = new Map<number, SlideFinding[]>();

/** Where a reel that wasn't watched live starts: the first slide a field cites, else the first with text. */
function startSlide(views: SlideView[]): number {
  const cited = views.find((v) => v.findings.length > 0);
  const read = views.find((v) => v.status === "read");
  return (cited ?? read ?? views[0])?.index ?? 1;
}

function UnplacedText({ text, label }: { text: string; label: string }) {
  return (
    <details className="rounded-2xl border border-ink/10 bg-white/50 px-4 py-3 text-sm">
      <summary className="cursor-pointer text-muted">
        {label} <span className="tabular-nums text-ink/40">· {text.length.toLocaleString("en-US")} characters</span>
      </summary>
      <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink/80">
        {text}
      </pre>
    </details>
  );
}

/**
 * The Deck section of the report: the slide, small, in the top-left corner,
 * and what was read off it and extracted from it beside it (below it when
 * the card is narrow). While a run is live the reel follows it:
 * page by page as the reader goes through the deck, then to each slide a
 * field is found on, as it's found. Afterwards it stays as a per-slide record
 * of what was read off each page and which fields came from it. Everything
 * shown is derived from `AnalysisState.deck` and the form by the selectors in
 * `features/deck-reader`; the slide images are drawn in the browser from `pdf` when there
 * is one.
 *
 * Remount it (via `key`) for a new run, so the reel starts from slide 1.
 */
export default function DeckSection({
  deck,
  form,
  active,
  pdf,
}: {
  deck: DeckState | undefined;
  form: DueDiligenceForm;
  active: boolean;
  pdf: PdfSource | null;
}) {
  const reducedMotion = useReducedMotion();
  const animate = active && !reducedMotion;

  const target = deck?.readThrough ?? 0;
  const total = deck ? deckTotal(deck) : 0;
  const cursor = usePacedReveal(target, { dwell: sweepDwell(total), animate });
  const scanning = active && !!deck && (!deck.read || cursor < target);

  const findings = useMemo(() => (deck ? findingsBySlide(deck, form) : NO_FINDINGS), [deck, form]);
  const views = useMemo(
    () => (deck ? buildSlideViews(deck, findings, { cursor, scanning }) : []),
    [deck, findings, cursor, scanning],
  );

  // Once the sweep is done, go to each field's slide in the order they're found.
  const tour = useMemo(() => (deck ? citationTour(deck) : []), [deck]);
  const toured = usePacedReveal(scanning ? 0 : tour.length, { dwell: FIND_DWELL, animate });
  const stop = !scanning && toured > 0 ? tour[toured - 1] : undefined;

  // Where the run is: the page being read, then the latest find.
  const live = total === 0 ? null : scanning ? Math.min(cursor + 1, total) : (stop?.slide ?? Math.max(1, Math.min(cursor, total)));

  const [picked, setPicked] = useState<number | null>(null);
  const following = active && picked === null;
  // Where following left the reel, so it doesn't jump once the run ends.
  const [rest, setRest] = useState<number | null>(null);
  if (following && live !== null && live !== rest) setRest(live);

  const wanted = picked ?? (following ? live : null) ?? rest ?? startSlide(views);
  const current = Math.min(Math.max(wanted, 1), Math.max(total, 1));
  const currentView = views[current - 1];

  const stopLabel = stop ? views[stop.slide - 1]?.findings.find((f) => f.key === stop.key)?.label : undefined;
  const found =
    following && stop && stop.slide === current ? { id: String(toured), slide: stop.slide, label: stopLabel ?? null } : null;

  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const thumbs = useDeckThumbnails(pdf, near && !!deck);
  const aspect = thumbs.aspect ?? 16 / 9;
  const imageFor = (index: number) => thumbs.urls[index - 1] ?? null;

  const unmapped = deck ? isUnmapped(deck) : false;
  const via = deck?.read ? deckViaLabel(deck.via) : null;
  // Before the first page arrives the slide spot holds a placeholder; a deck
  // read with no pages at all (pasted text, no markers) has no slide column.
  const waiting = views.length === 0 && !deck?.read;
  const slideColumn = views.length > 0 || waiting;

  return (
    <Card
      eyebrow="Deck"
      className="fade-up"
      actions={<span className="text-xs tabular-nums text-muted">{deckProgressLabel(deck, views, scanning)}</span>}
    >
      <div ref={nearRef} className="@container px-5 pb-5">
        {/* The slide column's width is what thumbnails.ts renders pages for. */}
        <div className={`grid gap-5 ${slideColumn ? "@xl:grid-cols-[15rem_minmax(0,1fr)] @xl:items-start" : ""}`}>
          {slideColumn && (
            <div className="w-full max-w-60">
              {views.length > 0 ? (
                <SlideReel
                  views={views}
                  imageFor={imageFor}
                  aspect={aspect}
                  current={current}
                  onChange={setPicked}
                  animate={animate}
                  found={found}
                  aside={
                    active &&
                    picked !== null && (
                      <button
                        type="button"
                        onClick={() => setPicked(null)}
                        className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/15"
                      >
                        <span aria-hidden className="size-1.5 rounded-full bg-accent step-active" />
                        Follow live
                      </button>
                    )
                  }
                />
              ) : (
                <div aria-hidden className="animate-pulse rounded-lg bg-ink/[0.06]" style={{ aspectRatio: aspect }} />
              )}
            </div>
          )}

          <div className="min-w-0 space-y-5">
            {unmapped && deck?.unassigned ? (
              <UnplacedText text={deck.unassigned} label="Everything it read, as one block" />
            ) : currentView ? (
              <SlideDetail
                key={current}
                view={currentView}
                active={active}
                highlight={found ? (stop?.key ?? null) : null}
              />
            ) : (
              waiting && <p className="text-sm text-muted">Opening the deck…</p>
            )}

            {!unmapped && deck?.unassigned && (
              <UnplacedText text={deck.unassigned} label="Text before the first slide marker" />
            )}

            {via && <p className="text-xs text-muted">Read with {via}.</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}
