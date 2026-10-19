"use client";

import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { SlideView } from "./selectors";
import SlideFrame, { type FrameFinding } from "./SlideFrame";

/** How far a swipe has to travel sideways, in px, to turn the page. */
const SWIPE_PX = 40;

/**
 * The slide being looked at, as wide as its column. Changing slide is an
 * instant cut: panning between pages, at the pace a live run moves, was
 * dizzying. The caller passes the image, the rail's thumbnail until the
 * full-size one is drawn, so a cut never flashes empty. The rail picks a
 * slide; with the stage focused ← → Home End move it too, and so does a swipe.
 * The caller owns which slide is current, so it can also follow a live run.
 */
export default function SlideStage({
  view,
  total,
  image,
  aspect,
  onChange,
  animate,
  found,
  blank,
}: {
  /** The slide in view. */
  view: SlideView;
  total: number;
  /** Its image URL, or null to show its number. */
  image: string | null;
  /** Width over height of the deck's pages. */
  aspect: number;
  onChange: (index: number) => void;
  /** Whether to play the glow on a find (a live run, motion allowed). */
  animate: boolean;
  /** A field just found on this slide. */
  found: FrameFinding | null;
  /** Shown instead of the slide when there are no page images to draw. */
  blank?: ReactNode;
}) {
  const current = view.index;
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
      {blank ?? (
        <div
          role="group"
          aria-roledescription="slide"
          aria-label={`Slide ${current} of ${total}`}
          className="touch-pan-y select-none"
          onPointerDown={(e) => (swipeFrom.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipeFrom.current = null)}
        >
          <SlideFrame view={view} image={image} aspect={aspect} animate={animate} found={found} />
        </div>
      )}
    </div>
  );
}
