"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildSlideViews,
  citationTour,
  deckProgressLabel,
  deckTotal,
  deckViaLabel,
  findingsBySlide,
  isUnmapped,
  type SlideFinding,
} from "./selectors";
import type { DeckState } from "@/features/deck-reader/types";
import type { DueDiligenceForm } from "@/lib/diligence/types";
import type { PdfSource } from "@/lib/analyses/pdf-source";
import { findDwell, sweepDwell, useDeckSlide, useDeckThumbnails, usePacedReveal, useReducedMotion } from "./hooks";
import SlideStage from "./SlideStage";
import SlideRail, { type RailLayout } from "./SlideRail";
import SlideDetail from "./SlideDetail";

const NO_FINDINGS = new Map<number, SlideFinding[]>();

function UnplacedText({ text, label }: { text: string; label: string }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted hover:text-ink">
        {label} <span className="tabular-nums text-ink/40">· {text.length.toLocaleString("en-US")} characters</span>
      </summary>
      <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-words font-mono leading-relaxed text-ink/70">
        {text}
      </pre>
    </details>
  );
}

/**
 * The Deck page: one slide big, every slide as a thumbnail in a rail to pick
 * from, and under the big slide what was read off it and the fields extracted
 * from it. It sits straight on the page, and the rail is the page's right-hand
 * sidebar (`sidebar`) from `lg` up and a strip between the slide and its text
 * below that. A saved report opens on slide 1, or the slide a link asks for.
 * While a run is live the stage follows it: page by page as the reader goes
 * through the deck, then to each slide a field is found on, as it's found.
 * Afterwards it stays as a per-slide record of what was read off each page and
 * which fields came from it. Everything shown is derived from
 * `AnalysisState.deck`, the form and the checked citations (`evidence`) by
 * the selectors in `features/deck-reader`; the slide images are drawn in the
 * browser from `pdf` when there is one.
 *
 * Remount it (via `key`) for a new run, so the stage starts from slide 1.
 */
export default function DeckSection({
  deck,
  form,
  evidence,
  active,
  pdf,
  openSlide = null,
  sidebar,
}: {
  deck: DeckState | undefined;
  form: DueDiligenceForm;
  /** Field key → the slides its deck value was read from, once checked against them. */
  evidence: Record<string, number[]>;
  active: boolean;
  pdf: PdfSource | null;
  /** A slide to open, as if picked: a link's `?slide=4`, e.g. from a feedback item. */
  openSlide?: number | null;
  /**
   * The page's right-hand column, to put the rail in. It shows from `lg` up;
   * below that the rail is a strip under the slide. Null until the frame has
   * drawn it.
   */
  sidebar: HTMLElement | null;
}) {
  const reducedMotion = useReducedMotion();
  const animate = active && !reducedMotion;

  const target = deck?.readThrough ?? 0;
  const total = deck ? deckTotal(deck) : 0;
  const cursor = usePacedReveal(target, { dwell: sweepDwell(total), animate });
  const scanning = active && !!deck && (!deck.read || cursor < target);

  const findings = useMemo(() => (deck ? findingsBySlide(evidence, form) : NO_FINDINGS), [deck, evidence, form]);
  const views = useMemo(
    () => (deck ? buildSlideViews(deck, findings, { cursor, scanning }) : []),
    [deck, findings, cursor, scanning],
  );

  // Once the sweep is done, go to each field's slide in the order they're found.
  const tour = useMemo(() => citationTour(evidence, findings), [evidence, findings]);
  const toured = usePacedReveal(scanning ? 0 : tour.length, { dwell: findDwell(tour.length), animate });
  const stop = !scanning && toured > 0 ? tour[toured - 1] : undefined;

  // Where the run is: the page being read, then the latest find.
  const live = total === 0 ? null : scanning ? Math.min(cursor + 1, total) : (stop?.slide ?? Math.max(1, Math.min(cursor, total)));

  const [picked, setPicked] = useState<number | null>(openSlide);
  // A different slide asked for while mounted (back and forward between links) opens too.
  const [opened, setOpened] = useState(openSlide);
  if (openSlide !== opened) {
    setOpened(openSlide);
    if (openSlide !== null) setPicked(openSlide);
  }
  const following = active && picked === null;
  // Where following left the stage, so it doesn't jump once the run ends.
  const [rest, setRest] = useState<number | null>(null);
  if (following && live !== null && live !== rest) setRest(live);

  const wanted = picked ?? (following ? live : null) ?? rest ?? 1;
  const current = Math.min(Math.max(wanted, 1), Math.max(total, 1));
  const currentView = views[current - 1];

  // The latest find, while it's on the stage: the slide glows and the field flashes.
  const found = animate && following && stop?.slide === current ? String(toured) : null;

  const thumbs = useDeckThumbnails(pdf, !!deck);
  // No PDF stored (MCP runs) or one pdf.js can't open: the tiles stay empty.
  const images = !!pdf && thumbs.status !== "error";
  useDeckSlide(pdf, current, !!deck && images && views.length > 0);
  const aspect = thumbs.aspect ?? 16 / 9;
  const imageFor = (index: number) => thumbs.urls[index - 1] ?? null;

  const unmapped = deck ? isUnmapped(deck) : false;
  const via = deck?.read ? deckViaLabel(deck.via) : null;
  // Before the first page arrives the slide spot holds a placeholder; a deck
  // read with no pages at all (pasted text, no markers) has no slide column.
  const waiting = views.length === 0 && !deck?.read;
  const slideColumn = views.length > 0 || waiting;

  const rail = (layout: RailLayout) => (
    <SlideRail
      views={views}
      imageFor={(index) => (images ? imageFor(index) : null)}
      aspect={aspect}
      current={current}
      onPick={setPicked}
      layout={layout}
    />
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs tabular-nums text-muted">{deckProgressLabel(deck, views, scanning)}</span>
        {active && picked !== null && (
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="text-xs font-medium text-accent hover:underline"
          >
            Follow live
          </button>
        )}
      </div>
      {/* The stage, the rail as a strip below `lg`, then what was read off the slide. */}
      <div className="grid gap-5">
        {slideColumn && (
          <div className="min-w-0">
            {currentView ? (
              <SlideStage
                view={currentView}
                total={views.length}
                image={thumbs.large[current] ?? imageFor(current)}
                aspect={aspect}
                onChange={setPicked}
                found={found}
                blank={
                  images ? null : (
                    <p className="text-sm text-muted">
                      {pdf
                        ? "No slide images: the stored PDF couldn't be opened."
                        : "No slide images: there's no PDF stored for this analysis."}
                    </p>
                  )
                }
              />
            ) : (
              <div aria-hidden className="animate-pulse rounded-lg bg-ink/[0.06]" style={{ aspectRatio: aspect }} />
            )}
          </div>
        )}

        {slideColumn && <div className="min-w-0 lg:hidden">{rail("strip")}</div>}

        <div className={`min-w-0 space-y-5 ${slideColumn ? "border-t border-ink/10 pt-5" : ""}`}>
          {unmapped && deck?.unassigned ? (
            <UnplacedText text={deck.unassigned} label="Everything it read, as one block" />
          ) : currentView ? (
            <SlideDetail key={current} view={currentView} active={active} highlight={found ? (stop?.key ?? null) : null} />
          ) : (
            waiting && <p className="text-sm text-muted">Opening the deck…</p>
          )}

          {!unmapped && deck?.unassigned && (
            <UnplacedText text={deck.unassigned} label="Text before the first slide marker" />
          )}

          {via && <p className="text-xs text-muted">Read with {via}.</p>}
        </div>
      </div>
      {slideColumn &&
        sidebar &&
        createPortal(
          <>
            <p className="px-4 pb-2 pt-4 text-xs font-medium text-muted">Slides</p>
            <div className="relative min-h-0 flex-1">{rail("column")}</div>
          </>,
          sidebar,
        )}
    </>
  );
}
