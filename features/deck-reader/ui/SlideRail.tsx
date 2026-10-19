"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import type { SlideView } from "./selectors";
import SlideFrame from "./SlideFrame";
import { useReducedMotion } from "./hooks";

/** Room left between the current tile and the rail's edge when it's scrolled into view, in px. */
const EDGE_PX = 8;

/** Tiles shown while the deck is still opening. */
const PLACEHOLDERS = 4;

/**
 * How the rail is laid out. A column fills a `relative` parent and scrolls
 * down; a strip scrolls sideways; `auto` is a strip that turns into a column
 * on a wide card (`@3xl`, so inside an `@container`).
 */
export type RailLayout = "auto" | "column" | "strip";

const LAYOUT: Record<RailLayout, { list: string; tile: string }> = {
  auto: {
    list: "flex gap-3 overflow-x-auto p-1 pb-2 @3xl:absolute @3xl:inset-0 @3xl:flex-col @3xl:overflow-x-hidden @3xl:overflow-y-auto @3xl:pb-1",
    tile: "w-32 shrink-0 @3xl:w-auto",
  },
  column: { list: "absolute inset-0 flex flex-col gap-3 overflow-y-auto px-3 pb-4 pt-1", tile: "" },
  strip: { list: "flex gap-3 overflow-x-auto p-1 pb-2", tile: "w-32 shrink-0" },
};

/** Scroll `list` (and nothing else) just enough to show `tile` on both axes. */
function keepInView(list: HTMLElement, tile: HTMLElement, smooth: boolean) {
  const l = list.getBoundingClientRect();
  const t = tile.getBoundingClientRect();
  let top = list.scrollTop;
  let left = list.scrollLeft;
  if (t.top < l.top + EDGE_PX) top -= l.top + EDGE_PX - t.top;
  else if (t.bottom > l.bottom - EDGE_PX) top += t.bottom - (l.bottom - EDGE_PX);
  if (t.left < l.left + EDGE_PX) left -= l.left + EDGE_PX - t.left;
  else if (t.right > l.right - EDGE_PX) left += t.right - (l.right - EDGE_PX);
  if (top !== list.scrollTop || left !== list.scrollLeft) {
    list.scrollTo({ top, left, behavior: smooth ? "smooth" : "instant" });
  }
}

/**
 * Every slide as a thumbnail, to pick one from: a column down the right (of
 * the page, or of a wide card) or a strip under the slide. Either way it
 * scrolls by itself. The current slide is outlined and kept in view as it
 * changes, by scrolling the rail only, never the page, so following a live run
 * doesn't drag the reader around. A chip counts the fields that cite a slide.
 * One tile is a tab stop; the arrow keys move between them.
 */
export default function SlideRail({
  views,
  imageFor,
  aspect,
  current,
  onPick,
  layout = "auto",
}: {
  views: SlideView[];
  /** Image URL for a page, or null to show its number. */
  imageFor: (index: number) => string | null;
  /** Width over height of the deck's pages. */
  aspect: number;
  /** The slide on the stage, 1-based. */
  current: number;
  onPick: (index: number) => void;
  layout?: RailLayout;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const placed = useRef(false);
  const reducedMotion = useReducedMotion();
  const total = views.length;

  useEffect(() => {
    const list = listRef.current;
    const tile = list?.querySelector<HTMLElement>(`[data-slide="${current}"]`);
    if (!list || !tile) return;
    // Jump on the first showing (a link to slide 12), glide after that. Runs
    // again when the tiles change shape (the PDF's page size arrives late).
    keepInView(list, tile, placed.current && !reducedMotion);
    placed.current = true;
    if (list.contains(document.activeElement)) tile.focus({ preventScroll: true });
  }, [current, total, aspect, reducedMotion]);

  const onKeyDown = (e: KeyboardEvent) => {
    const to = {
      ArrowUp: current - 1,
      ArrowLeft: current - 1,
      ArrowDown: current + 1,
      ArrowRight: current + 1,
      Home: 1,
      End: total,
    }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    if (to >= 1 && to <= total) onPick(to);
  };

  return (
    <ol
      ref={listRef}
      aria-label="Slides"
      onKeyDown={onKeyDown}
      className={LAYOUT[layout].list}
    >
      {total === 0
        ? Array.from({ length: PLACEHOLDERS }, (_, i) => (
            <li key={i} aria-hidden className={`pl-5.5 ${LAYOUT[layout].tile}`}>
              <div className="animate-pulse rounded-lg bg-ink/[0.06]" style={{ aspectRatio: aspect }} />
            </li>
          ))
        : views.map((view) => {
            const on = view.index === current;
            const cited = view.findings.length;
            return (
              <li key={view.index} className={LAYOUT[layout].tile}>
                <button
                  type="button"
                  data-slide={view.index}
                  tabIndex={on ? 0 : -1}
                  onClick={() => onPick(view.index)}
                  aria-current={on ? "true" : undefined}
                  aria-label={`Slide ${view.index}${cited ? `, ${cited === 1 ? "1 field" : `${cited} fields`} cited` : ""}`}
                  className="group flex w-full items-start gap-1.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span
                    aria-hidden
                    className={`w-4 shrink-0 pt-0.5 text-right text-[11px] tabular-nums ${
                      on ? "font-semibold text-accent" : "text-ink/40"
                    }`}
                  >
                    {view.index}
                  </span>
                  <span
                    className={`relative min-w-0 flex-1 rounded-[10px] border-2 p-px transition-colors ${
                      on ? "border-accent" : "border-transparent group-hover:border-ink/15"
                    }`}
                  >
                    <SlideFrame view={view} image={imageFor(view.index)} aspect={aspect} animate={false} found={null} />
                    {cited > 0 && (
                      <span
                        aria-hidden
                        className="absolute right-1 top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 tabular-nums text-white shadow-sm"
                      >
                        {cited}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
    </ol>
  );
}
