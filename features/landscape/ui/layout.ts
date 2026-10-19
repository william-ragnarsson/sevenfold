/**
 * Keeps logos on the landscape grid from stacking. The model often places
 * similar companies at near-identical coordinates; drawn as-is, their logos
 * and names pile on top of each other. This nudges overlapping points apart
 * until each has room, moving them as little as possible so the map still
 * reads true.
 *
 * Everything is in percent of the grid (0–100 on both axes). The gap is the
 * room one logo plus its name needs, so an overlap is measured as an ellipse rather
 * than a circle: names are wider than they are tall. Deterministic: the same
 * input always lays out the same way, on the server and in the browser. The
 * result is rounded, because Node and the browser can disagree on the last
 * digit of `Math.hypot`, and a different style string breaks hydration.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Room each point needs, in percent of the grid's width and height. A logo and
 * its name are the same size in pixels on any screen, so the narrow (phone,
 * square) grid needs a bigger share of its width per point than the wide one.
 */
export const GAPS = {
  narrow: { x: 24, y: 17 },
  wide: { x: 18, y: 13 },
} satisfies Record<string, Point>;
/**
 * Keep logos clear of the edges, where they'd clip. The bottom margin is
 * wider because each name hangs under its logo, and would otherwise run past
 * the plot into the axis labels.
 */
const MIN = { x: 7, y: 11 };
const MAX = 93;
const ITERATIONS = 40;

const clampX = (n: number) => Math.min(MAX, Math.max(MIN.x, n));
const clampY = (n: number) => Math.min(MAX, Math.max(MIN.y, n));
const round = (n: number) => Math.round(n * 100) / 100;

export function spreadPoints(points: Point[], gap: Point = GAPS.wide): Point[] {
  const out = points.map((p) => ({ x: clampX(p.x), y: clampY(p.y) }));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        // Distance in "gaps": 1 means the two just touch.
        const dx = (out[j].x - out[i].x) / gap.x;
        const dy = (out[j].y - out[i].y) / gap.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= 1) continue;
        // Direction to push apart. Points exactly on top of each other split
        // along a fixed angle per pair, so they fan out instead of moving in
        // lockstep.
        const angle = (i + j) * 2.39996; // the golden angle, in radians
        const ux = dist < 1e-6 ? Math.cos(angle) : dx / dist;
        const uy = dist < 1e-6 ? Math.sin(angle) : dy / dist;
        // Each point moves half the overlap, damped so the layout settles.
        const push = ((1 - dist) / 2) * 0.6;
        out[i] = { x: clampX(out[i].x - ux * push * gap.x), y: clampY(out[i].y - uy * push * gap.y) };
        out[j] = { x: clampX(out[j].x + ux * push * gap.x), y: clampY(out[j].y + uy * push * gap.y) };
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out.map((p) => ({ x: round(p.x), y: round(p.y) }));
}
