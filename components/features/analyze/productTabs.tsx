import type { ProductSlug } from "@/lib/products";
import { DOC_SECTIONS, readField } from "@/lib/diligence/form-schema";
import type { AnalysisState } from "@/lib/diligence/stream-state";
import type { DiligencePhase } from "@/lib/diligence/types";
import { SCORECARD_METRIC_KEYS } from "@/features/scorecard/form";

/**
 * The product tab registry: for each page of an analysis (`lib/products.ts`),
 * which report sections it draws and how far along it is (the sidebar's status
 * dots). The pages themselves are generic — adding a product page is a slug in
 * `lib/products.ts`, its section in `reportSections.tsx`, and an entry here.
 */

/** How far along a product is in one analysis. */
export type TabStatus = "ready" | "running" | "failed" | "empty";

export interface ProductTab {
  /** Ids from `REPORT_SECTIONS`, top to bottom. */
  sections: readonly string[];
  /** Where the product is in this run, before a stopped run is taken into account. */
  status: (s: AnalysisState, active: boolean) => TabStatus;
  /**
   * True when this report was saved before the product existed, so it has no
   * slice for it at all: "not in this report", even when the run stopped short.
   */
  absent?: (s: AnalysisState) => boolean;
}

/** True once the run has moved past `phase`. */
function stepDone(s: AnalysisState, phase: DiligencePhase): boolean {
  return s.steps.find((step) => step.phase === phase)?.status === "done";
}

/** The memo's text cells a model can fill (the manual-only ones aren't counted). */
const MEMO_TEXT_KEYS = DOC_SECTIONS.flatMap((section) =>
  section.fields.filter((f) => f.kind === "text" && !f.manualOnly).map((f) => f.key),
);

function memoFilled(s: AnalysisState): number {
  return MEMO_TEXT_KEYS.filter((key) => readField(s.form, key)?.value).length;
}

function hasFounders(s: AnalysisState): boolean {
  const f = s.form.founders;
  return f.members.length > 0 || !!f.howTheyMet.value || !!f.capTable.value;
}

/** The scored ratings (0 = unscored), in model-feature order. */
function ratings(s: AnalysisState): number[] {
  return SCORECARD_METRIC_KEYS.map((k) => s.form.scorecard[k]).filter((r) => r > 0);
}

export const PRODUCT_TABS: Record<ProductSlug, ProductTab> = {
  summary: {
    sections: ["summary"],
    // It glimpses the other pages, so it's ready once any of them has something.
    status: (s, active) => {
      if (s.verdict) return "ready";
      if (active) return "running";
      return memoFilled(s) > 0 || ratings(s).length > 0 ? "ready" : "empty";
    },
  },
  deck: {
    sections: ["deck"],
    status: (s, active) => {
      if (s.deck?.read) return "ready";
      if (active) return "running";
      // Reports saved before per-slide reading have no deck at all.
      return s.deck && s.deck.slides.length > 0 ? "ready" : "empty";
    },
    // Every run since sends the deck before anything else, so a report that got
    // past reading the deck without one predates it — as does one with no
    // landscape slice, which came out just before the deck did.
    absent: (s) => s.deck === undefined && (stepDone(s, "extracting") || s.landscape === undefined),
  },
  memo: {
    // Research has no page of its own: its searches close the memo.
    sections: ["document", "sources"],
    status: (s, active) =>
      active && !stepDone(s, "completing") ? "running" : memoFilled(s) > 0 ? "ready" : "empty",
  },
  founders: {
    sections: ["founders"],
    status: (s, active) =>
      active && !stepDone(s, "completing") ? "running" : hasFounders(s) ? "ready" : "empty",
  },
  landscape: {
    sections: ["landscape"],
    status: (s, active) => {
      if (s.landscape) return "ready";
      // A failed stage says so even while the rest of the run carries on.
      if (s.landscapeError) return "failed";
      return active ? "running" : "empty";
    },
    // Reports since keep `landscape: null` until it's mapped.
    absent: (s) => s.landscape === undefined,
  },
  results: {
    // The call first, then the ratings behind it, then what to fix in the deck.
    sections: ["verdict", "scorecard", "feedback"],
    status: (s, active) => {
      // Verdict is the last stage, so by then the feedback has all streamed in.
      if (s.verdict) return "ready";
      if (active) return "running";
      return ratings(s).length > 0 || s.deckFeedback.length > 0 ? "ready" : "empty";
    },
  },
};

/** True when the report was saved before this product existed (see `ProductTab.absent`). */
export function tabAbsent(slug: ProductSlug, s: AnalysisState): boolean {
  return PRODUCT_TABS[slug].absent?.(s) ?? false;
}

/**
 * A tab's status in this analysis. When the run stopped short, a product that
 * never got its turn reads as failed rather than empty; a report saved before
 * a product existed (absent, not failed) stays empty.
 */
export function tabStatus(slug: ProductSlug, s: AnalysisState, active: boolean, stopped: boolean): TabStatus {
  const status = PRODUCT_TABS[slug].status(s, active);
  return status === "empty" && stopped && !tabAbsent(slug, s) ? "failed" : status;
}

/** How each status looks in the sidebar: a dot colour and a word for screen readers. */
export const STATUS_META: Record<TabStatus, { label: string; dot: string }> = {
  ready: { label: "Ready", dot: "bg-accent-bright" },
  running: { label: "Running", dot: "bg-amber-500 animate-pulse" },
  failed: { label: "Didn't finish", dot: "bg-red-500" },
  empty: { label: "Not in this report", dot: "bg-ink/20" },
};

/** One line icon per product page, in `currentColor`. */
export function ProductTabIcon({ slug, className }: { slug: ProductSlug | "overview"; className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={"shrink-0 " + className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {slug === "overview" && (
        <>
          {/* A compass of tiles: the analysis at a glance. */}
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="16" height="7" rx="1.5" />
        </>
      )}
      {slug === "summary" && (
        <>
          {/* A few lines of text, the first one long. */}
          <path d="M5 6h14M5 11h10M5 16h12M5 20h7" />
        </>
      )}
      {slug === "deck" && (
        <>
          {/* A slide on an easel. */}
          <rect x="3" y="4" width="18" height="12" rx="1.5" />
          <path d="M12 16v4M8 20h8M7 9h6M7 12h4" />
        </>
      )}
      {slug === "memo" && (
        <>
          {/* A filled-in worksheet. */}
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <path d="M14 3v5h5M9 13h6M9 17h4" />
        </>
      )}
      {slug === "founders" && (
        <>
          {/* Two people. */}
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16 14.2a4.5 4.5 0 0 1 5 4.8" />
        </>
      )}
      {slug === "landscape" && (
        <>
          {/* Two axes and a few dots. */}
          <path d="M4 4v16h16" />
          <circle cx="9" cy="14" r="1.5" />
          <circle cx="14" cy="9" r="1.5" />
          <circle cx="17" cy="15" r="1.5" />
        </>
      )}
      {slug === "results" && (
        <>
          {/* Bars of a rating. */}
          <path d="M5 20v-6M10 20V9M15 20v-8M20 20V5" />
        </>
      )}
    </svg>
  );
}
