"use client";

import Link from "next/link";
import Dropzone from "@/components/ui/Dropzone";
import CurrentAnalysisCard from "@/components/features/analyze/CurrentAnalysisCard";
import SampleDeckPrompt from "@/components/features/analyze/SampleDeckPrompt";
import { useAnalysis } from "@/components/features/analyze/AnalysisProvider";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { ROUTES, signInPath } from "@/lib/routes";

type AnalysisLauncherProps = {
  /** `dark` restyles the controls for the hero card's dark surface. */
  tone?: "light" | "dark";
  /** Tighter dropzone, for when it shares a row with other content. */
  compact?: boolean;
  /** `center` centres the run button under the dropzone. */
  align?: "left" | "center";
  /** Opaque, lifted dropzone — see `Dropzone`. Light tone only. */
  elevated?: boolean;
};

const TONES = {
  light: {
    run: "bg-ink text-paper hover:bg-accent disabled:hover:bg-ink",
    panel: "border border-ink/10 bg-white/55 backdrop-blur",
    panelElevated: "bg-white shadow-[0_40px_80px_-40px_rgba(20,25,35,0.45)]",
    title: "text-ink",
    hint: "text-muted",
  },
  dark: {
    run: "bg-accent-bright text-ink hover:bg-white disabled:hover:bg-accent-bright",
    panel: "border border-white/10 bg-white/[0.04]",
    panelElevated: "border border-white/10 bg-white/[0.04]",
    title: "text-white",
    hint: "text-white/60",
  },
} as const;

/**
 * The upload + run control pair, plus the sample-deck escape hatch. One analysis
 * runs at a time, so while one is in flight this swaps the dropzone for the live
 * analysis card (which carries its own abort control).
 *
 * The sample sticker is part of this component rather than an opt-in prop: every
 * dropzone on the site is a place where someone can discover they have no PDF to
 * hand, so every dropzone needs the same way out. It was a `sample` flag at
 * first, and it immediately drifted — /due-diligence (now /app/decks) had it and the closing CTA
 * on the home page didn't, for no reason anyone chose.
 *
 * Rendered in the hero card (dark, compact), the home page's closing CTA (light,
 * elevated) and on /app/decks (light); it reads everything it needs from the
 * analysis context, so the call sites stay in sync without prop drilling.
 */
export default function AnalysisLauncher({
  tone = "light",
  compact = false,
  align = "left",
  elevated = false,
}: AnalysisLauncherProps) {
  const { file, setFile, status, start } = useAnalysis();
  const { configured, loading, isIdentified } = useAuth();
  const t = TONES[tone];
  // Block layout, not flex: the dropzone must stay full-width, and flex children
  // shrink to content under `items-start`. Only the button needs centring.
  const button = align === "center" ? "mx-auto block" : "";

  // The card carries its own abort control.
  if (status === "loading") return <CurrentAnalysisCard tone={tone} />;

  // Runs happen in the dashboard, which needs an account (proxy.ts), so a
  // signed-out visitor on the home page is sent to make one first rather than
  // dropping a deck they can't run. Only once the session has resolved: the
  // dashboard's own launcher is always signed in, and must never flash this.
  if (configured && !loading && !isIdentified) {
    return (
      <div
        className={`rounded-3xl text-center ${elevated ? t.panelElevated : t.panel} ${
          compact ? "px-6 py-7 sm:py-8" : "px-8 py-14"
        }`}
      >
        <p className={`text-lg font-semibold ${t.title}`}>Analyse a pitch deck</p>
        <p className={`mx-auto mt-1.5 max-w-sm text-sm ${t.hint}`}>
          Make an account to run one. Every report is kept in it.
        </p>
        <Link
          href={signInPath(ROUTES.decks)}
          className={`mt-5 inline-block rounded-full px-8 py-3.5 font-semibold transition-colors ${t.run}`}
        >
          Get started →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* The sticker is positioned against the dropzone, not stacked under it:
          overlapping the panel's corner — and, from lg up, jutting past its
          right edge — is what makes it read as stuck on top of the UI rather
          than as part of it. Needs the wrapper because Dropzone's own
          `relative` box is where its dashed-border SVG lives.

          The overhang is gated at lg on purpose. This page is `max-w-3xl px-6`,
          so below 48rem the container is full-width and the only gutter is that
          24px of padding — hanging out there would cross the viewport edge and
          give the whole page a horizontal scrollbar. At lg the container is
          capped and centred, leaving ~128px a side for the sticker to sit in. */}
      <div className="relative">
        <Dropzone file={file} onFile={setFile} tone={tone} compact={compact} elevated={elevated} />
        <div className="absolute -top-4 right-2 z-10 sm:-top-5 lg:-right-8">
          <SampleDeckPrompt />
        </div>
      </div>
      {/* Only once there's something to run. Idle, the panel is just the
          dropzone and the sample sticker — a permanently-disabled button next
          to a live green one read as clutter, and as two competing offers.
          It can't go away entirely: the sticker runs the sample deck, this runs
          the file you actually uploaded. */}
      {file && (
        <button
          onClick={() => start()}
          className={`rounded-full px-8 py-3.5 font-semibold transition-colors ${button} ${t.run}`}
        >
          Run due diligence →
        </button>
      )}
    </div>
  );
}
