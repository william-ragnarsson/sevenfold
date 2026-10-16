"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { FUNDING_STEPS, TRAINING_FRAMES } from "@/lib/invest/training-frames";

/**
 * A few made-up decks scored at every amount raised, replayed as the model's
 * 100 rules (trees) are added one at a time. Every line starts flat at the
 * same score and bends into shape: value proposition lifts it, raising past
 * about $1.6M drops it.
 *
 * The server render is the finished chart, so there's something to read
 * without JS. Once hydrated it rewinds to rule 0 while still off screen and
 * plays when it scrolls into view; reduced motion leaves it finished, and the
 * controls work either way.
 *
 * The plot is a stretched 100 × 100 SVG (lines only, non-scaling strokes) with
 * the labels in HTML, so the box can change shape between phone and desktop.
 */
const LAST = TRAINING_FRAMES.vp5.length - 1;
const PLAY_MS = 5200;
const TICKS = [0, 20, 40, 60, 80, 100];

const SERIES = [
  { key: "vp12", label: "Value proposition 1–2", stroke: "var(--muted)", width: 2, opacity: 0.7 },
  { key: "vp4", label: "Value proposition 4", stroke: "var(--accent)", width: 2.5, opacity: 0.45 },
  { key: "vp5", label: "Value proposition 5", stroke: "var(--accent)", width: 3.5, opacity: 1 },
  { key: "allFives", label: "Five stars on everything", stroke: "var(--ink)", width: 2, opacity: 1, dash: "6 5" },
] as const;

const x = (i: number) => 4 + (i / (FUNDING_STEPS.length - 1)) * 92;
const y = (score: number) => 100 - score;
/** Labels that don't fit side by side on a phone; the shaded band still marks $1.6M. */
const SMALL_HIDDEN = new Set(["$100K", "$1M", "$1.7M"]);

/** A deck's score at a fractional rule count, between the two frames around it. */
function scoreAt(frames: number[][], t: number, i: number) {
  const lo = Math.floor(t);
  const hi = Math.min(LAST, lo + 1);
  return frames[lo][i] + (frames[hi][i] - frames[lo][i]) * (t - lo);
}

function cancel(raf: RefObject<number | null>) {
  if (raf.current !== null) cancelAnimationFrame(raf.current);
  raf.current = null;
}

/** Plays from rule `from` to the last one at a steady pace, one rule per frame or so. */
function play(raf: RefObject<number | null>, from: number, setT: (t: number) => void, setPlaying: (p: boolean) => void) {
  cancel(raf);
  setPlaying(true);
  const start = performance.now() - (from / LAST) * PLAY_MS;
  const step = (now: number) => {
    const t = Math.min(LAST, ((now - start) / PLAY_MS) * LAST);
    setT(t);
    if (t < LAST) {
      raf.current = requestAnimationFrame(step);
    } else {
      raf.current = null;
      setPlaying(false);
    }
  };
  raf.current = requestAnimationFrame(step);
}

export default function TrainingReplay({ gate, label }: { gate: number; label: string }) {
  const [t, setT] = useState(LAST);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = plot.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let rewound = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          play(raf, 0, setT, setPlaying);
        } else if (!rewound) {
          // The first report comes straight after observe(): still off
          // screen, so rewind now and nobody sees the jump.
          rewound = true;
          setT(0);
        }
      },
      // Start once the plot itself is well on screen, not just the legend.
      { threshold: 0, rootMargin: "0px 0px -30% 0px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancel(raf);
    };
  }, []);

  const rules = Math.round(t);
  const done = t >= LAST;

  function toggle() {
    if (playing) {
      cancel(raf);
      setPlaying(false);
    } else {
      play(raf, done ? 0 : t, setT, setPlaying);
    }
  }

  return (
    <div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        {[...SERIES].reverse().map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <svg width="20" height="6" aria-hidden>
              <line
                x1="1"
                x2="19"
                y1="3"
                y2="3"
                stroke={s.stroke}
                strokeOpacity={s.opacity}
                strokeWidth={s.width}
                strokeDasharray={"dash" in s ? "4 3" : undefined}
                strokeLinecap="round"
              />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>

      <div ref={plot} role="img" aria-label={label} className="mt-5 grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2">
        <div className="relative">
          {TICKS.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 text-[11px] tabular-nums text-muted"
              style={{ top: `${y(tick)}%` }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="relative aspect-[5/4] sm:aspect-[2/1]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <rect x="0" y="0" width="100" height={y(gate)} fill="var(--accent)" fillOpacity="0.05" />
            <rect x={x(4)} y="0" width={x(5) - x(4)} height="100" fill="var(--ink)" fillOpacity="0.04" />
            {TICKS.map((tick) => (
              <line
                key={tick}
                x1="0"
                x2="100"
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--ink)"
                strokeOpacity="0.08"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <line
              x1="0"
              x2="100"
              y1={y(gate)}
              y2={y(gate)}
              stroke="var(--accent)"
              strokeOpacity="0.6"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            {SERIES.map((s) => (
              <polyline
                key={s.key}
                points={FUNDING_STEPS.map((_, i) => `${x(i)},${y(scoreAt(TRAINING_FRAMES[s.key], t, i))}`).join(" ")}
                fill="none"
                stroke={s.stroke}
                strokeOpacity={s.opacity}
                strokeWidth={s.width}
                strokeDasharray={"dash" in s ? s.dash : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <span
            className="absolute left-2 -translate-y-full pb-1 text-[11px] font-semibold text-accent"
            style={{ top: `${y(gate)}%` }}
          >
            Invest: {gate} or more
          </span>
          <span
            className="absolute top-1.5 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-muted"
            style={{ left: `${(x(4) + x(5)) / 2}%` }}
          >
            ≈ $1.6M
          </span>
        </div>

        <span />
        <div className="relative mt-2 h-4">
          {FUNDING_STEPS.map((step, i) => (
            <span
              key={step}
              className={
                "absolute -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-muted " +
                (SMALL_HIDDEN.has(step) ? "hidden sm:inline" : "")
              }
              style={{ left: `${x(i)}%` }}
            >
              {step}
            </span>
          ))}
        </div>
        <span />
        <p className="mt-1 text-center text-xs font-medium text-muted">Amount raised (evenly spaced, not to scale)</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ink/10 pt-5">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={playing}
          className="inline-flex min-w-[6.5rem] items-center justify-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-accent"
        >
          {playing ? "❚❚ Pause" : done ? "↺ Replay" : "▶ Play"}
        </button>
        <label className="flex min-w-0 flex-1 basis-56 items-center gap-3 text-sm text-muted">
          <span className="sr-only">Rules learned</span>
          <input
            type="range"
            min={0}
            max={LAST}
            step={1}
            value={rules}
            onChange={(e) => {
              cancel(raf);
              setPlaying(false);
              setT(Number(e.target.value));
            }}
            className="min-w-0 flex-1 accent-accent"
          />
          <output className="w-[7.5rem] shrink-0 text-right tabular-nums">
            <span className="font-semibold text-ink">{rules}</span> of {LAST} rules
          </output>
        </label>
      </div>
    </div>
  );
}
