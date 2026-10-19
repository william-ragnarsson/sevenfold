"use client";

import Link from "next/link";
import ReportView from "./ReportView";
import { REPORT_SECTIONS, type ReportEnv } from "./reportSections";
import { useAnalysisScroll } from "./AnalysisFrame";
import { useReport } from "./ReportProvider";
import { PRODUCT_TABS, tabAbsent, tabStatus } from "./productTabs";
import { analysisPath, deckSlidePath } from "@/lib/routes";
import { productPage, type ProductSlug } from "@/lib/products";

/**
 * One product's page of an analysis: the report sections `productTabs.tsx`
 * lists for it, stacked. The "report" page is the whole report with its
 * chapters nav.
 */
export default function ProductView({
  slug,
  slide = null,
}: {
  slug: ProductSlug;
  /** The slide the url asks for (`?slide=4`), for the Deck section. */
  slide?: number | null;
}) {
  const report = useReport();
  const scrollRef = useAnalysisScroll();
  // The frame shows the loading and missing states.
  if (!report?.state) return null;
  const { id, state, active, pdf, failure, canEdit, editMemo, saveStatus } = report;
  const tab = PRODUCT_TABS[slug];
  const env: ReportEnv = {
    pdf,
    slide,
    slideHref: (n) => deckSlidePath(id, n),
    memo: canEdit ? { edit: editMemo, saveStatus } : undefined,
  };

  if (tab.sections === "all") {
    return <ReportView state={state} active={active} env={env} scrollRef={scrollRef} />;
  }

  const page = productPage(slug);
  const failed = tabStatus(slug, state, active, !active && failure !== null) === "failed";
  const sections = tab.sections
    .map((sectionId) => REPORT_SECTIONS.find((s) => s.id === sectionId))
    .filter((s) => s !== undefined)
    .filter((s) => s.available(state, active));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{page.label}</h1>
        <p className="mt-1 text-muted">{page.description}</p>
      </header>
      {sections.length > 0 ? (
        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              {s.render(state, active, env)}
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-ink/20 px-6 py-12 text-center">
          <p className="font-semibold text-ink">{failed ? "Didn't finish" : "Not in this report"}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            {failed
              ? "The run stopped before it got here. Run the deck again to fill it in."
              : tabAbsent(slug, state)
                ? `This analysis was made before ${page.label.toLowerCase()} was part of the report. Run the deck again to add it.`
                : "Nothing turned up for this deck. Run it again to have another go."}
          </p>
          <Link
            href={analysisPath(id)}
            className="mt-5 inline-block rounded-full border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            ← Overview
          </Link>
        </div>
      )}
    </div>
  );
}
