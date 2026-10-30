"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DevCostSidebar from "./DevCostSidebar";
import { useReport } from "./ReportProvider";
import { analysisPath, ROUTES } from "@/lib/routes";
import { PRODUCT_PAGES, productSlugOf } from "@/lib/products";

const AsideContext = createContext<HTMLElement | null>(null);

/**
 * The frame's right-hand column, for a page to portal a sidebar of its own
 * into (the Deck page's slide rail). It runs the full height of the screen and
 * stays put while the page scrolls, and shows only from `lg` up and only once
 * something is in it. Null until the frame has drawn it.
 */
export function useAnalysisAside(): HTMLElement | null {
  return useContext(AsideContext);
}

const BACK_LINK =
  "shrink-0 rounded-full border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink";

/**
 * Everything an analysis's pages share: the loading and missing states, the
 * page pills on screens too narrow for the sidebar, the failure banner, a
 * right-hand column a page can fill (`useAnalysisAside`) and the dev cost
 * overlay. Sits in the analysis's layout, so moving between its pages swaps
 * only the page itself.
 */
export default function AnalysisFrame({ children }: { children: ReactNode }) {
  const report = useReport();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [aside, setAside] = useState<HTMLDivElement | null>(null);

  // The scroll element outlives the page in it, so a new page starts at the
  // top. A link to a section (`results#feedback`) is Next's: it has already
  // scrolled there by the time this runs.
  useEffect(() => {
    if (!location.hash) scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  if (!report || !report.settled) {
    return <div className="mx-auto max-w-3xl px-6 pt-16 text-center text-muted">Loading report…</div>;
  }

  const { id, isLive, record, state, failure } = report;

  if (!state) {
    // Either the deck was never analyzed under this account, or the run died
    // before it wrote anything.
    const interrupted = record?.status === "running" || record?.status === "error";
    return (
      <div className="mx-auto max-w-3xl px-6 pt-16 text-center">
        <p className="text-lg font-semibold text-ink">
          {interrupted ? "This analysis didn’t finish." : "This analysis isn’t available."}
        </p>
        <p className="mt-2 text-muted">
          {interrupted
            ? record?.error || "It was stopped partway through. Run the deck again to get a report."
            : "It may belong to another account, or it was deleted."}
        </p>
        <div className="mt-6 flex justify-center">
          <Link href={ROUTES.analyses} className={BACK_LINK}>
            ← All analyses
          </Link>
        </div>
      </div>
    );
  }

  const slug = productSlugOf(pathname);
  const tabs = [
    { href: analysisPath(id), label: "Overview", on: !slug },
    ...PRODUCT_PAGES.map((p) => ({ href: analysisPath(id, p.slug), label: p.label, on: p.slug === slug })),
  ];

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      {/* The sidebar's tabs, for screens too narrow to show it. */}
      <nav
        aria-label="Analysis pages"
        className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-ink/10 bg-paper/85 px-5 py-2.5 backdrop-blur lg:hidden"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.on ? "page" : undefined}
            className={
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors " +
              (tab.on ? "bg-ink text-paper" : "text-ink/70 hover:bg-ink/5 hover:text-ink")
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="flex">
        <div className="mx-auto min-w-0 max-w-6xl flex-1 px-5 py-6">
          {failure && (
            <p className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-700">
              {failure}
            </p>
          )}
          <AsideContext.Provider value={aside}>{children}</AsideContext.Provider>
        </div>
        {/* Shown from `lg` up only, where AppShell makes the frame exactly
            one screen tall, so `h-dvh` fills it. */}
        <div
          ref={setAside}
          className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col border-l border-ink/10 bg-paper-2/40 lg:has-[>*]:flex"
        />
      </div>

      {isLive && <DevCostSidebar usage={state.usage} />}
    </div>
  );
}
