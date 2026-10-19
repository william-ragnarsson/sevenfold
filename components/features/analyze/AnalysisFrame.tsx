"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PhaseStepper from "./PhaseStepper";
import DevCostSidebar from "./DevCostSidebar";
import { useReport } from "./ReportProvider";
import { analysisPath, ROUTES } from "@/lib/routes";
import { PRODUCT_PAGES, productPage, productSlugOf } from "@/lib/products";

const ScrollContext = createContext<RefObject<HTMLDivElement | null> | null>(null);
const AsideContext = createContext<HTMLElement | null>(null);

/** The element an analysis's pages scroll in — the full report's chapters nav spies on it. */
export function useAnalysisScroll(): RefObject<HTMLDivElement | null> {
  const ref = useContext(ScrollContext);
  if (!ref) throw new Error("useAnalysisScroll must be used inside AnalysisFrame");
  return ref;
}

/**
 * The frame's right-hand column, for a page to portal a sidebar of its own
 * into (the Deck page's slide rail). It sits under the header and stays put
 * while the page scrolls, and shows only from `lg` up and only once something
 * is in it. Null until the frame has drawn it.
 */
export function useAnalysisAside(): HTMLElement | null {
  return useContext(AsideContext);
}

const BACK_LINK =
  "shrink-0 rounded-full border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink";

/**
 * Everything an analysis's pages share: the loading and missing states, a
 * sticky header (where you are, and how far the run has got), the failure
 * banner, a right-hand column a page can fill (`useAnalysisAside`) and the
 * dev cost overlay. Sits in the analysis's layout, so moving between its pages
 * swaps only the content below the header.
 */
export default function AnalysisFrame({ children }: { children: ReactNode }) {
  const report = useReport();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [aside, setAside] = useState<HTMLDivElement | null>(null);

  // The right-hand column sticks under the header and fills the rest of the
  // screen, so it needs the header's height, which wraps with the window.
  const measureHeader = useCallback((header: HTMLDivElement | null) => {
    const frame = header?.parentElement;
    if (!header || !frame) return;
    const observer = new ResizeObserver(() => {
      frame.style.setProperty("--frame-head", `${header.getBoundingClientRect().height}px`);
      frame.style.setProperty("--frame-view", `${frame.getBoundingClientRect().height}px`);
    });
    observer.observe(header);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // The scroll element outlives the page in it; a new page starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  if (!report || !report.settled) {
    return <div className="mx-auto max-w-3xl px-6 pt-16 text-center text-muted">Loading report…</div>;
  }

  const { id, name, isLive, record, state, active, failure } = report;

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
  const page = slug ? productPage(slug) : null;
  const tabs = [
    { href: analysisPath(id), label: "Overview", on: !page },
    ...PRODUCT_PAGES.map((p) => ({ href: analysisPath(id, p.slug), label: p.label, on: p.slug === slug })),
  ];

  return (
    <ScrollContext.Provider value={scrollRef}>
      {/* While a page fills the right-hand column, `--aside-w` is its width: the
          header's row is centred over the content beside it rather than the
          whole width. */}
      <div ref={scrollRef} className="h-full overflow-y-auto lg:has-[[data-aside]>*]:[--aside-w:13rem]">
        <div
          ref={measureHeader}
          className="sticky top-0 z-10 border-b border-ink/10 bg-paper/85 pr-[var(--aside-w,0px)] backdrop-blur"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
              <Link href={ROUTES.analyses} className="shrink-0 text-muted transition-colors hover:text-ink">
                Analyses
              </Link>
              <span className="text-ink/25">/</span>
              {page ? (
                <>
                  <Link href={analysisPath(id)} className="truncate text-muted transition-colors hover:text-ink">
                    {name}
                  </Link>
                  <span className="text-ink/25">/</span>
                  <span aria-current="page" className="shrink-0 font-semibold text-ink">
                    {page.label}
                  </span>
                </>
              ) : (
                <span aria-current="page" className="truncate font-semibold text-ink">
                  {name}
                </span>
              )}
            </nav>
            <div className="min-w-0 flex-1 basis-[28rem]">
              <PhaseStepper steps={state.steps} startedAt={state.startedAt} active={active} />
            </div>
          </div>
          {/* The sidebar's tabs, for screens too narrow to show it. */}
          <nav aria-label="Analysis pages" className="flex gap-1 overflow-x-auto px-5 pb-2.5 lg:hidden">
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
        </div>

        <div className="flex">
          <div className="mx-auto min-w-0 max-w-6xl flex-1 px-5 py-6">
            {failure && (
              <p className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-700">
                {failure}
              </p>
            )}
            <AsideContext.Provider value={aside}>{children}</AsideContext.Provider>
          </div>
          <div
            ref={setAside}
            data-aside
            className="sticky top-[var(--frame-head,0px)] hidden h-[calc(var(--frame-view,100dvh)-var(--frame-head,0px))] w-[var(--aside-w)] shrink-0 flex-col border-l border-ink/10 bg-paper-2/40 lg:has-[>*]:flex"
          />
        </div>

        {isLive && <DevCostSidebar usage={state.usage} />}
      </div>
    </ScrollContext.Provider>
  );
}
