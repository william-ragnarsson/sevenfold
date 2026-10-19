import type { ReactNode } from "react";
import VerdictPopup from "@/features/verdict/ui/VerdictPopup";
import DeckFeedbackPanel, { type SlideHref } from "@/features/feedback/ui/DeckFeedbackPanel";
import ScorecardPanel from "@/features/scorecard/ui/ScorecardPanel";
import { ResearchSources } from "@/features/research/ui/ResearchLog";
import MemoView, { type FieldRenderer } from "@/features/memo/ui/MemoView";
import FoundersRows from "@/features/founders/ui/FoundersRows";
import FoundersPanel from "@/features/founders/ui/FoundersPanel";
import DeckSection from "@/features/deck-reader/ui/DeckSection";
import { deckTotal, isUnmapped } from "@/features/deck-reader/ui/selectors";
import LandscapePanel from "@/features/landscape/ui/LandscapePanel";
import type { AnalysisState } from "@/lib/diligence/stream-state";
import type { PdfSource } from "@/lib/analyses/pdf-source";

/** What a section may need beyond the analysis state. */
export interface ReportEnv {
  /** The deck's PDF, for slide images. */
  pdf: PdfSource | null;
  /** The slide the url asks the Deck section to open (`?slide=4`), if any. */
  slide: number | null;
  /** A link to one slide on this analysis's Deck page. */
  slideHref: (slide: number) => string;
}

/**
 * The report section registry — the single place that decides what sections the
 * report has, their order, and their labels. It drives both the stacked content
 * column and the chapters nav of the full report, and each product page draws
 * the sections `productTabs.tsx` lists for it. Adding a section (e.g. a future
 * checklist) is one entry here plus its component.
 */
export interface ReportSection {
  /** Anchor id used for scroll-spy + jump links. */
  id: string;
  /** Label shown in the chapters nav. */
  label: string;
  /** Gate a section until it has real data to show, or the run is still active (skeleton). */
  available: (state: AnalysisState, active: boolean) => boolean;
  render: (state: AnalysisState, active: boolean, env: ReportEnv) => ReactNode;
  /** Only on its product page — the full report already shows it inside another section. */
  pageOnly?: true;
}

/**
 * Links feedback items to the Deck page, for the slides it can show: none when
 * the deck wasn't split into pages (or the report predates the deck slice), and
 * none past its last page.
 */
function feedbackSlideHref(state: AnalysisState, env: ReportEnv): SlideHref | undefined {
  const deck = state.deck;
  if (!deck || isUnmapped(deck)) return undefined;
  const total = deckTotal(deck);
  return (slide) => (slide <= total ? env.slideHref(slide) : null);
}

/** The memo's non-text fields, drawn by the products that own them. */
const MEMO_RENDERERS: Partial<Record<"founders", FieldRenderer>> = {
  founders: ({ form, active }) => <FoundersRows form={form} active={active} />,
};

export const REPORT_SECTIONS: ReportSection[] = [
  {
    id: "verdict",
    label: "Verdict",
    available: (s, active) => active || !!s.verdict,
    render: (s, active) => <VerdictPopup verdict={s.verdict} active={active} />,
  },
  {
    id: "deck",
    label: "Deck",
    // Reports saved before per-slide reading existed have no deck slice.
    available: (s, active) => active || !!s.deck,
    render: (s, active, env) => (
      <DeckSection
        key={s.startedAt}
        deck={s.deck}
        form={s.form}
        active={active}
        pdf={env.pdf}
        openSlide={env.slide}
      />
    ),
  },
  {
    id: "founders",
    label: "Founders",
    // The memo's founders rows, on their own; the full report has them in the memo.
    pageOnly: true,
    available: () => true,
    render: (s, active) => <FoundersPanel form={s.form} active={active} />,
  },
  {
    id: "feedback",
    label: "Deck feedback",
    available: (s, active) => active || s.deckFeedback.length > 0,
    render: (s, active, env) => (
      <DeckFeedbackPanel items={s.deckFeedback} active={active} slideHref={feedbackSlideHref(s, env)} />
    ),
  },
  {
    id: "scorecard",
    label: "Scorecard",
    available: () => true,
    render: (s, active) => <ScorecardPanel form={s.form} active={active} legacyFunding={!s.fundingInUsd} />,
  },
  {
    id: "landscape",
    label: "Competitive Landscape",
    // Reports saved before this section have no `landscape` at all. A failed
    // stage stays visible and says why, rather than vanishing when the run ends.
    available: (s, active) => active || !!s.landscape || !!s.landscapeError,
    render: (s, active) => (
      <LandscapePanel
        landscape={s.landscape ?? null}
        error={s.landscapeError ?? null}
        searches={s.landscapeSearches ?? []}
        active={active}
      />
    ),
  },
  {
    id: "document",
    label: "Document",
    available: () => true,
    render: (s, active) => <MemoView form={s.form} active={active} renderers={MEMO_RENDERERS} />,
  },
  {
    // Research's searches and notes: where the memo's web answers came from,
    // so they close the memo (and the report) like a bibliography.
    id: "sources",
    label: "Sources",
    available: (s, active) => active || s.searches.length > 0 || !!s.notes,
    render: (s, active) => <ResearchSources state={s} active={active} />,
  },
];
