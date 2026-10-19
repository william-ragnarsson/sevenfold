"use client";

import Link from "next/link";
import VerdictPopup from "@/features/verdict/ui/VerdictPopup";
import { useReport } from "./ReportProvider";
import { PRODUCT_SLUGS, PRODUCT_TABS, ProductTabIcon, STATUS_META, tabStatus } from "./productTabs";
import { analysisPath } from "@/lib/routes";
import { productPage } from "@/lib/products";

/**
 * An analysis at a glance: what the company is, the call, and one card per
 * product saying how far it got and what it found. Each card opens that
 * product's page; the full report is one more card at the end.
 */
export default function AnalysisOverview() {
  const report = useReport();
  // The frame shows the loading and missing states.
  if (!report?.state) return null;
  const { id, name, state, active, failure } = report;
  const stopped = !active && failure !== null;
  const description = state.form.company.description.value;
  const full = productPage("report");

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{name}</h1>
        {description ? (
          <p className="mt-2 text-muted">{description}</p>
        ) : active ? (
          <span className="mt-3 inline-block h-4 w-72 max-w-full animate-pulse rounded bg-ink/10" />
        ) : null}
      </header>

      {(active || state.verdict) && <VerdictPopup verdict={state.verdict} active={active} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PRODUCT_SLUGS.map((slug) => {
          const page = productPage(slug);
          const status = tabStatus(slug, state, active, stopped);
          const meta = STATUS_META[status];
          const summary = PRODUCT_TABS[slug].summary(state, active);
          return (
            <Link
              key={slug}
              href={analysisPath(id, slug)}
              className="group flex flex-col rounded-3xl border border-ink/12 bg-paper-2/50 p-5 backdrop-blur transition-colors hover:border-ink/25 hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-paper">
                  <ProductTabIcon slug={slug} />
                </span>
                <span className="font-semibold text-ink">{page.label}</span>
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.pill}`}>
                  {meta.label}
                </span>
              </div>
              <p className="mt-4 min-h-[1.5rem] text-sm font-semibold text-ink">
                {summary ?? (status === "running" ? "Working on it…" : "—")}
              </p>
              <p className="mt-1 text-sm text-muted">{page.description}</p>
              <span className="mt-auto pt-4 text-sm font-medium text-accent group-hover:underline">Open →</span>
            </Link>
          );
        })}
        <Link
          href={analysisPath(id, "report")}
          className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl bg-ink p-5 text-paper transition-colors hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-accent sm:col-span-2 xl:col-span-3"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
            <ProductTabIcon slug="report" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{full.label}</span>
            <span className="block text-sm text-on-ink-muted">{full.description}</span>
          </span>
          <span className="text-sm font-medium text-accent-bright group-hover:underline">Read it all →</span>
        </Link>
      </div>
    </div>
  );
}
