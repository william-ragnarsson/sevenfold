import { useCallback, useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";
import type { PdfSource } from "@/lib/analyses/pdf-source";
import { NO_THUMBNAILS, getThumbnails, requestSlide, subscribeThumbnails, type DeckThumbnails } from "./thumbnails";

/** The deck's page images as they render. Nothing loads while `enabled` is false. */
export function useDeckThumbnails(source: PdfSource | null, enabled: boolean): DeckThumbnails {
  const watched = enabled ? source : null;
  const subscribe = useCallback(
    (onChange: () => void) => (watched ? subscribeThumbnails(watched, onChange) : () => {}),
    [watched],
  );
  const snapshot = () => (watched ? getThumbnails(watched.key) : NO_THUMBNAILS);
  return useSyncExternalStore(subscribe, snapshot, () => NO_THUMBNAILS);
}

/**
 * Has page `n` drawn full size while it's the one shown; it lands in
 * `useDeckThumbnails`'s `large`. Nothing loads while `enabled` is false.
 */
export function useDeckSlide(source: PdfSource | null, n: number, enabled: boolean): void {
  useEffect(() => {
    if (enabled && source) requestSlide(source, n);
  }, [source, n, enabled]);
}

/** True once the element has come within `margin` of the viewport, and stays true. */
export function useNearViewport<T extends Element>(margin = "300px"): [(node: T | null) => void, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (!node || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: margin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, near, margin]);

  return [setNode, near];
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => false);
}

/**
 * How long the reader stays on each page of a deck this long, in ms: about
 * eight seconds for the whole deck, within limits.
 */
export function sweepDwell(total: number): number {
  return Math.min(700, Math.max(150, 8000 / Math.max(total, 1)));
}

/**
 * A count that walks up to `target` one step per `dwell` ms, so things that
 * arrive in a burst (pages from the text layer, a batch of fields) still play
 * out one at a time. It is never ahead of `target`, and a long backlog moves
 * several steps at once so it can't fall minutes behind. Without `animate` it
 * is `target`. Remount (via `key`) to start over.
 */
export function usePacedReveal(target: number, { dwell, animate }: { dwell: number; animate: boolean }): number {
  const [shown, setShown] = useState(0);
  const behind = animate && shown < target;
  // Reads the latest target when the step lands. Keeping `target` out of the
  // timer's deps matters: items arriving faster than `dwell` would otherwise
  // restart the timer every time, and nothing would move until they stopped.
  const step = useEffectEvent(() => setShown((s) => s + Math.max(1, Math.floor((target - s) / 20))));

  useEffect(() => {
    if (!behind) return;
    const timer = setTimeout(step, dwell);
    return () => clearTimeout(timer);
  }, [behind, shown, dwell]);

  return animate ? Math.min(shown, target) : target;
}
