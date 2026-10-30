import type { ReactNode } from "react";
import VerdictPopup from "@/features/verdict/ui/VerdictPopup";
import DeckFeedbackPanel from "@/features/feedback/ui/DeckFeedbackPanel";
import ScorecardPanel from "@/features/scorecard/ui/ScorecardPanel";
import { ResearchSources } from "@/features/research/ui/ResearchLog";
import MemoView, { type FieldRenderer } from "@/features/memo/ui/MemoView";
import FoundersRows from "@/features/founders/ui/FoundersRows";
import FoundersPanel from "@/features/founders/ui/FoundersPanel";
import DeckSection from "@/features/deck-reader/ui/DeckSection";
import { deckTotal, isUnmapped } from "@/features/deck-reader/ui/selectors";
import LandscapePanel from "@/features/landscape/ui/LandscapePanel";
import type { SlideHref } from "@/components/report/SlideChips";
import type { AnalysisState } from "@/lib/diligence/stream-state";
import { citedSlides } from "@/lib/diligence/evidence";
import type { MemoEdit } from "@/lib/diligence/edits";
import type { PdfSource } from "@/lib/analyses/pdf-source";
import type { ProductSlug } from "@/lib/products";
import MemoToolbar from "./MemoToolbar";
import SummaryView from "./SummaryView";
import type { SaveStatus } from "./ReportProvider";

/** What a section may need beyond the analysis state. */
export interface ReportEnv {
  /** The deck's PDF, for slide images. */
  pdf: PdfSource | null;
  /** The slide the url asks the Deck section to open (`?slide=4`), if any. */
  slide: number | null;
  /** A link to one slide on this analysis's Deck page. */
  slideHref: (slide: number) => string;
  /** A link to another page of this analysis, for the Summary's links out. */
  pageHref: (slug: ProductSlug) => string;
  /** Editing the memo, where it can be edited (see `ReportProvider`). */
  memo?: { edit: (edit: MemoEdit) => void; saveStatus: SaveStatus };
  /**
   * The page's right-hand column (`useAnalysisAside`), for a section's own
   * sidebar: the Deck page puts its slide rail there. It shows from `lg` up,
   * so a section keeps its own copy inline below that. Null until the frame
   * has drawn it.
   */
  aside: HTMLElement | null;
}

/**
 * The report section registry: every section an analysis can show. Each
 * product page draws the sections `productTabs.tsx` lists for it, in that
 * order. Adding a section (e.g. a future checklist) is one entry here plus its
 * component.
 */
interface ReportSection {
  /** The section's anchor on its page, for links like `results#feedback`. */
  id: string;
  /** Gate a section until it has real data to show, or the run is still active (skeleton). */
  available: (state: AnalysisState, active: boolean) => boolean;
  render: (state: AnalysisState, active: boolean, env: ReportEnv) => ReactNode;
}

/**
 * Links slide numbers (feedback items', the memo's sources) to the Deck page,
 * for the slides it can show: none when the deck wasn't split into pages (or
 * the report predates the deck slice), and none past its last page.
 */
function slideHrefFor(state: AnalysisState, env: ReportEnv): SlideHref | undefined {
  const deck = state.deck;
  if (!deck || isUnmapped(deck)) return undefined;
  const total = deckTotal(deck);
  return (slide) => (slide <= total ? env.slideHref(slide) : null);
}

/** The memo's non-text fields, drawn by the products that own them. */
function memoRenderers(state: AnalysisState, env: ReportEnv): Partial<Record<"founders", FieldRenderer>> {
  const edit = env.memo?.edit;
  return {
    founders: ({ form, active }) => (
      <FoundersRows
        form={form}
        active={active}
        evidence={citedSlides(state).founders}
        slideHref={slideHrefFor(state, env)}
        onChange={edit && ((members) => edit({ kind: "founders", members }))}
      />
    ),
  };
}

export const REPORT_SECTIONS: ReportSection[] = [
  {
    // The other pages in brief; each block says what it's missing.
    id: "summary",
    available: () => true,
    render: (s, active, env) => <SummaryView state={s} active={active} pageHref={env.pageHref} />,
  },
  {
    id: "verdict",
    available: (s, active) => active || !!s.verdict,
    render: (s, active) => <VerdictPopup verdict={s.verdict} active={active} />,
  },
  {
    id: "deck",
    // Reports saved before per-slide reading existed have no deck slice.
    available: (s, active) => active || !!s.deck,
    render: (s, active, env) => (
      <DeckSection
        key={s.startedAt}
        deck={s.deck}
        form={s.form}
        evidence={citedSlides(s)}
        active={active}
        pdf={env.pdf}
        openSlide={env.slide}
        sidebar={env.aside}
      />
    ),
  },
  {
    id: "founders",
    // The memo's founders rows, on their own.
    available: () => true,
    render: (s, active, env) => (
      <FoundersPanel form={s.form} active={active} evidence={citedSlides(s)} slideHref={slideHrefFor(s, env)} />
    ),
  },
  {
    id: "feedback",
    available: (s, active) => active || s.deckFeedback.length > 0,
    render: (s, active, env) => (
      <DeckFeedbackPanel items={s.deckFeedback} active={active} slideHref={slideHrefFor(s, env)} />
    ),
  },
  {
    id: "scorecard",
    available: () => true,
    render: (s, active) => <ScorecardPanel form={s.form} active={active} legacyFunding={!s.fundingInUsd} />,
  },
  {
    id: "landscape",
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
    available: () => true,
    render: (s, active, env) => {
      const edit = env.memo?.edit;
      return (
        <MemoView
          form={s.form}
          active={active}
          renderers={memoRenderers(s, env)}
          evidence={citedSlides(s)}
          slideHref={slideHrefFor(s, env)}
          onEditField={
            edit &&
            ((key, { value, source }) =>
              // "unknown" isn't offered: only an emptied cell gets it.
              edit({ kind: "field", key, value, source: source === "unknown" ? undefined : source }))
          }
          toolbar={!active && <MemoToolbar state={s} saveStatus={env.memo?.saveStatus} />}
        />
      );
    },
  },
  {
    // Research's searches and notes: where the memo's web answers came from,
    // so they close the memo like a bibliography.
    id: "sources",
    available: (s, active) => active || s.searches.length > 0 || !!s.notes,
    render: (s, active) => <ResearchSources state={s} active={active} />,
  },
];
