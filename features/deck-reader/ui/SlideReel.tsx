"use client";

import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { SlideView } from "./selectors";
import SlideFrame, { type FrameFinding } from "./SlideFrame";

/** How far a swipe has to travel sideways, in px, to turn the page. */
const SWIPE_PX = 40;

const ARROW_PATH = {
  prev: "M12.5 4.5 7 10l5.5 5.5",
  next: "M7.5 4.5 13 10l-5.5 5.5",
};

function Arrow({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous slide" : "Next slide"}
      className="grid size-7 place-items-center rounded-full border border-ink/10 bg-white/60 text-ink hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30"
    >
      <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path d={ARROW_PATH[dir]} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * The deck one slide at a time, as wide as its container, with the arrows and
 * the counter underneath. Changing slide is an instant cut: panning between
 * pages, at the pace a live run moves, was dizzying. The other pages stay laid
 * out side by side out of view, so their images are already decoded and a cut
 * never flashes the placeholder. Arrows, ← → and a swipe move it; the caller
 * owns which slide is current, so it can also follow a live run.
 */
export default function SlideReel({
  views,
  imageFor,
  aspect,
  current,
  onChange,
  animate,
  found,
  aside,
}: {
  views: SlideView[];
  /** Image URL for a page, or null to show its number. */
  imageFor: (index: number) => string | null;
  /** Width over height of the deck's pages. */
  aspect: number;
  /** The slide in view, 1-based. */
  current: number;
  onChange: (index: number) => void;
  /** Whether to play the glow on a find (a live run, motion allowed). */
  animate: boolean;
  /** A field just found, and the slide it was found on. */
  found: (FrameFinding & { slide: number }) | null;
  /** Shown at the end of the controls row. */
  aside?: ReactNode;
}) {
  const total = views.length;
  const swipeFrom = useRef<{ x: number; y: number } | null>(null);

  const go = (index: number) => {
    if (index >= 1 && index <= total && index !== current) onChange(index);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const to = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 1, End: total }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    go(to);
  };

  const onPointerUp = (e: PointerEvent) => {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    if (!from) return;
    const dx = e.clientX - from.x;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(e.clientY - from.y)) return;
    go(dx < 0 ? current + 1 : current - 1);
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Deck slides"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <div
        className="touch-pan-y select-none overflow-hidden rounded-lg"
        onPointerDown={(e) => (swipeFrom.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipeFrom.current = null)}
      >
        <div className="flex gap-3" style={{ transform: `translateX(calc(${1 - current} * (100% + 0.75rem)))` }}>
          {views.map((view) => {
            const away = view.index !== current;
            return (
              <div
                key={view.index}
                role="group"
                aria-roledescription="slide"
                aria-label={`Slide ${view.index} of ${total}`}
                aria-hidden={away}
                inert={away}
                className="w-full shrink-0"
              >
                <SlideFrame
                  view={view}
                  image={imageFor(view.index)}
                  aspect={aspect}
                  animate={animate}
                  found={found?.slide === view.index ? found : null}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Arrow dir="prev" disabled={current <= 1} onClick={() => go(current - 1)} />
          <span className="min-w-14 text-center text-sm tabular-nums text-muted">
            {current} / {total}
          </span>
          <Arrow dir="next" disabled={current >= total} onClick={() => go(current + 1)} />
        </div>
        {aside}
      </div>
    </div>
  );
}
