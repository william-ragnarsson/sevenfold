"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
} from "./selectors";
import type { DeckState } from "@/features/deck-reader/types";
import type { DueDiligenceForm } from "@/lib/diligence/types";
import type { PdfSource } from "@/lib/analyses/pdf-source";
import { sweepDwell, useDeckSlide, useDeckThumbnails, useNearViewport, usePacedReveal, useReducedMotion } from "./hooks";
import SlideStage from "./SlideStage";
import SlideRail, { type RailLayout } from "./SlideRail";
import SlideDetail from "./SlideDetail";

/** How long the stage stays on each new find before going to the next, in ms. */
const FIND_DWELL = 1200;

const NO_FINDINGS = new Map<number, SlideFinding[]>();

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
 * The Deck section of the report: one slide big, every slide as a thumbnail
 * in a rail to pick from, and under the big slide what was read off it and the
 * fields extracted from it. On its own page the rail is the page's right-hand
 * sidebar (`sidebar`); in the full report it runs down the right of the card.
 * Either way, when there isn't room it's a strip between the slide and its
 * text. A saved report opens on slide 1, or the slide a link asks for. While a run is live the stage follows it: page by page as the
 * reader goes through the deck, then to each slide a field is found on, as
 * it's found. Afterwards it stays as a per-slide record of what was read off
 * each page and which fields came from it. Everything shown is derived from
 * `AnalysisState.deck` and the form by the selectors in `features/deck-reader`;
 * the slide images are drawn in the browser from `pdf` when there is one.
 *
 * Remount it (via `key`) for a new run, so the stage starts from slide 1.
 */
export default function DeckSection({
  deck,
  form,
  active,
  pdf,
  openSlide = null,
  sidebar = null,
}: {
  deck: DeckState | undefined;
  form: DueDiligenceForm;
  active: boolean;
  pdf: PdfSource | null;
  /** A slide to open, as if picked: a link's `?slide=4`, e.g. from a feedback item. */
  openSlide?: number | null;
  /**
   * The page's right-hand column, to put the rail in. It shows from `lg` up;
   * below that the rail stays in the card as a strip.
   */
  sidebar?: HTMLElement | null;
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

  const stopLabel = stop ? views[stop.slide - 1]?.findings.find((f) => f.key === stop.key)?.label : undefined;
  const found =
    following && stop && stop.slide === current ? { id: String(toured), slide: stop.slide, label: stopLabel ?? null } : null;

  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const thumbs = useDeckThumbnails(pdf, near && !!deck);
  // No PDF stored (MCP runs) or one pdf.js can't open: the tiles show numbers.
  const images = !!pdf && thumbs.status !== "error";
  useDeckSlide(pdf, current, near && !!deck && images && views.length > 0);
  const aspect = thumbs.aspect ?? 16 / 9;
  const imageFor = (index: number) => thumbs.urls[index - 1] ?? null;

  const unmapped = deck ? isUnmapped(deck) : false;
  const via = deck?.read ? deckViaLabel(deck.via) : null;
  // Before the first page arrives the slide spot holds a placeholder; a deck
  // read with no pages at all (pasted text, no markers) has no slide column.
  const waiting = views.length === 0 && !deck?.read;
  const slideColumn = views.length > 0 || waiting;
  // In the card, a wide one puts the rail beside the slide and its text.
  const railBeside = slideColumn && !sidebar;

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
    <Card
      eyebrow="Deck"
      className="fade-up"
      actions={
        <>
          {active && picked !== null && (
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/15"
            >
              <span aria-hidden className="size-1.5 rounded-full bg-accent step-active" />
              Follow live
            </button>
          )}
          <span className="text-xs tabular-nums text-muted">{deckProgressLabel(deck, views, scanning)}</span>
        </>
      }
    >
      <div ref={nearRef} className="@container px-5 pb-5">
        {/* Rail beside, on a wide card: the stage over the details on the left,
            the rail the full height of both on the right. Otherwise stage,
            rail (if it isn't in the page's sidebar), details, one under another. */}
        <div
          className={`grid gap-5 ${
            railBeside ? "@3xl:grid-cols-[minmax(0,1fr)_10rem] @3xl:grid-rows-[auto_1fr]" : ""
          }`}
        >
          {slideColumn && (
            <div className="min-w-0">
              {currentView ? (
                <SlideStage
                  view={currentView}
                  total={views.length}
                  image={thumbs.large[current] ?? imageFor(current)}
                  aspect={aspect}
                  onChange={setPicked}
                  animate={animate}
                  found={found}
                  blank={
                    images ? null : (
                      <p className="rounded-lg border border-dashed border-ink/15 px-4 py-3 text-sm text-muted">
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

          {railBeside && (
            // Wide, the rail is laid over this cell so it takes the left column's height and scrolls.
            <div className="relative min-w-0 @3xl:col-start-2 @3xl:row-span-2 @3xl:row-start-1 @3xl:min-h-96">
              {rail("auto")}
            </div>
          )}
          {slideColumn && sidebar && <div className="min-w-0 lg:hidden">{rail("strip")}</div>}

          <div className="min-w-0 space-y-5 @3xl:col-start-1">
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

      {slideColumn &&
        sidebar &&
        createPortal(
          <>
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Slides</span>
              {views.length > 0 && <span className="ml-auto text-xs tabular-nums text-muted">{views.length}</span>}
            </div>
            <div className="relative min-h-0 flex-1">{rail("column")}</div>
          </>,
          sidebar,
        )}
    </Card>
  );
}
