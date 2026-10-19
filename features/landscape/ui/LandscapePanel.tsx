"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import { SearchList, SourceRow } from "@/components/report/Sources";
import type { SearchGroup } from "@/lib/diligence/stream-state";
import type { CompetitiveLandscape, LandscapeAxis, LandscapeCompany } from "@/lib/diligence/types";
import CompanyLogo from "./CompanyLogo";
import LandscapeGrid from "./LandscapeGrid";

/**
 * Where the startup sits among its competitors. Up top, the map of every
 * company on the two axes the model judged most decisive for this market,
 * beside the summary and why those axes. Underneath, the closest competitors
 * side by side (why each competes, how the startup differs), then the rest of
 * the map as a list. Hovering a company in either list picks it out on the
 * map, and hovering a logo on the map picks out its row.
 */

function Subhead({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/40">{children}</p>;
}

/** The company's name, linked to its site when it has one. */
function CompanyName({ company, className }: { company: LandscapeCompany; className: string }) {
  if (!company.website) return <span className={className}>{company.name}</span>;
  return (
    <a
      href={company.website}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} underline-offset-2 hover:text-accent hover:underline`}
    >
      {company.name}
    </a>
  );
}

function LogoBubble({ company }: { company: LandscapeCompany }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-ink/10">
      <CompanyLogo company={company} className="h-4 w-4" />
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-semibold tabular-nums text-paper">
      {rank}
    </span>
  );
}

function AxisNote({ name, glyph, axis }: { name: string; glyph: string; axis: LandscapeAxis }) {
  return (
    <div>
      <p className="flex items-baseline gap-1.5 text-sm font-semibold text-ink">
        <span className="font-normal text-ink/35" aria-hidden>
          {glyph}
        </span>
        <span className="sr-only">{name}: </span>
        {axis.label}
      </p>
      <p className="mt-0.5 text-xs text-muted">
        {axis.low} → {axis.high}
      </p>
      {axis.why && <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{axis.why}</p>}
    </div>
  );
}

/** Hover and keyboard focus both pick a company out on the map. */
function hoverProps(onHover: (on: boolean) => void) {
  return {
    onMouseEnter: () => onHover(true),
    onMouseLeave: () => onHover(false),
    onFocus: () => onHover(true),
    onBlur: () => onHover(false),
  };
}

/** Company | Why they compete | How the startup differs, from `md` up. */
const COMPARE_COLUMNS = "md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,1fr)]";

/** One column of a comparison row. On phones the row stacks, so it names itself. */
function CompareCell({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40 md:hidden">{label}</p>
      <p className={`text-sm leading-relaxed ${text ? "text-ink/75" : "text-ink/30"}`}>{text || "—"}</p>
    </div>
  );
}

function CompetitorRow({
  company,
  subjectName,
  active,
  onHover,
}: {
  company: LandscapeCompany;
  subjectName: string;
  active: boolean;
  onHover: (on: boolean) => void;
}) {
  return (
    <li
      {...hoverProps(onHover)}
      className={`grid gap-x-6 gap-y-3 rounded-lg px-3 py-4 transition-colors ${COMPARE_COLUMNS} ${
        active ? "bg-ink/[0.04]" : ""
      }`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <RankBadge rank={company.rank!} />
        <div className="min-w-0 -mt-1">
          <div className="flex min-w-0 items-center gap-2">
            <LogoBubble company={company} />
            <CompanyName company={company} className="min-w-0 truncate text-sm font-semibold text-ink" />
          </div>
          {company.description && <p className="mt-1.5 text-xs leading-relaxed text-muted">{company.description}</p>}
        </div>
      </div>
      <CompareCell label="Why they compete" text={company.whyCompetitor} />
      <CompareCell label={`How ${subjectName} differs`} text={company.contrast} />
    </li>
  );
}

function CompanyRow({
  company,
  active,
  onHover,
}: {
  company: LandscapeCompany;
  active: boolean;
  onHover: (on: boolean) => void;
}) {
  return (
    <li
      {...hoverProps(onHover)}
      className={`flex min-w-0 items-start gap-2.5 rounded-lg px-3 py-2.5 transition-colors ${active ? "bg-ink/[0.04]" : ""}`}
    >
      <LogoBubble company={company} />
      <div className="min-w-0">
        <CompanyName company={company} className="text-sm font-medium text-ink" />
        {company.description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{company.description}</p>}
      </div>
    </li>
  );
}

function Skeleton() {
  return (
    <div className="px-5 pb-5">
      <div className="flex h-48 animate-pulse items-center justify-center rounded-xl border border-ink/10 bg-ink/[0.04]">
        <span className="text-sm text-muted">Mapping competitors…</span>
      </div>
    </div>
  );
}

/** The stage's searches as they happen, until the map is ready. */
function Working({ searches }: { searches: SearchGroup[] }) {
  if (searches.length === 0) return <Skeleton />;
  const sourceCount = searches.reduce((n, group) => n + group.sources.length, 0);
  return (
    <div className="space-y-4 px-5 pb-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="animate-pulse font-medium text-ink/70">Mapping competitors…</span>
        <span className="text-ink/20">•</span>
        <span><span className="font-semibold text-ink">{searches.length}</span> searches</span>
        <span className="text-ink/20">•</span>
        <span><span className="font-semibold text-ink">{sourceCount}</span> sources</span>
      </div>
      <SearchList searches={searches} sourceCount={sourceCount} />
    </div>
  );
}

function Failed({ message }: { message: string }) {
  return (
    <div className="px-5 pb-5">
      <div className="rounded-2xl border border-dashed border-ink/15 bg-ink/[0.02] px-5 py-6 text-center">
        <p className="text-sm font-semibold text-ink">Couldn&rsquo;t map the competitors</p>
        <p className="mt-1 text-sm text-muted">{message} The rest of the report is unaffected.</p>
      </div>
    </div>
  );
}

export default function LandscapePanel({
  landscape,
  error = null,
  searches = [],
  active = false,
}: {
  landscape: CompetitiveLandscape | null;
  /** Why the stage failed, if it did. */
  error?: string | null;
  /** The stage's web searches so far, shown while it works. */
  searches?: SearchGroup[];
  active?: boolean;
}) {
  // The company picked out on the map, as an index into `landscape.companies`.
  const [highlight, setHighlight] = useState<number | null>(null);

  if (!landscape && !error && !active) return null;
  if (!landscape) {
    return (
      <Card eyebrow="Competitive landscape" className="fade-up">
        {error ? <Failed message={error} /> : <Working searches={searches} />}
      </Card>
    );
  }

  const indexed = landscape.companies.map((company, index) => ({ company, index }));
  const subject = landscape.companies.find((c) => c.subject);
  const subjectName = subject?.name || "the startup";
  const top = indexed.filter(({ company }) => company.rank !== null).sort((a, b) => a.company.rank! - b.company.rank!);
  const rest = indexed.filter(({ company }) => !company.subject && company.rank === null);
  const hover = (index: number) => (on: boolean) => setHighlight(on ? index : null);

  return (
    <Card eyebrow="Competitive landscape" className="fade-up">
      <div className="space-y-8 px-5 pb-5">
        {/* Phones read summary, map, axes; from `xl` the map takes the left column. */}
        <div className="grid gap-x-8 gap-y-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:grid-rows-[auto_1fr]">
          {landscape.summary && (
            <p className="max-w-3xl text-[15px] leading-relaxed text-ink/80 xl:col-start-2 xl:row-start-1">
              {landscape.summary}
            </p>
          )}

          <div className="xl:col-start-1 xl:row-span-2 xl:row-start-1">
            <LandscapeGrid landscape={landscape} highlight={highlight} onHighlight={setHighlight} />
          </div>

          <div className="xl:col-start-2 xl:row-start-2">
            <Subhead>Reading the map</Subhead>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <AxisNote name="Horizontal axis" glyph="↔" axis={landscape.xAxis} />
              <AxisNote name="Vertical axis" glyph="↕" axis={landscape.yAxis} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
              {subject && (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-white ring-2 ring-accent" aria-hidden />
                  {subjectName}
                </span>
              )}
              {top.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[9px] font-semibold text-paper" aria-hidden>
                    1
                  </span>
                  Closest competitors, compared below
                </span>
              )}
            </div>
          </div>
        </div>

        {top.length > 0 && (
          <section>
            <Subhead>Closest competitors</Subhead>
            <div
              className={`-mx-3 hidden gap-x-6 border-b border-ink/10 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40 md:grid ${COMPARE_COLUMNS}`}
              aria-hidden
            >
              <span>Company</span>
              <span>Why they compete</span>
              <span className="truncate">How {subjectName} differs</span>
            </div>
            <ol className="-mx-3 divide-y divide-ink/[0.07]">
              {top.map(({ company, index }) => (
                <CompetitorRow
                  key={`${company.name}-${index}`}
                  company={company}
                  subjectName={subjectName}
                  active={highlight === index}
                  onHover={hover(index)}
                />
              ))}
            </ol>
          </section>
        )}

        {rest.length > 0 && (
          <section>
            <Subhead>Also on the map</Subhead>
            <ul className="-mx-3 grid gap-x-6 sm:grid-cols-2">
              {rest.map(({ company, index }) => (
                <CompanyRow
                  key={`${company.name}-${index}`}
                  company={company}
                  active={highlight === index}
                  onHover={hover(index)}
                />
              ))}
            </ul>
          </section>
        )}

        {landscape.sources.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/40 hover:text-ink/60 [&::-webkit-details-marker]:hidden">
              <span className="transition-transform group-open:rotate-90">›</span>
              Sources · {landscape.sources.length}
            </summary>
            <div className="mt-2 -mx-2">
              {landscape.sources.map((source, i) => (
                <SourceRow key={`${source.url}-${i}`} title={source.title || source.url} url={source.url} />
              ))}
            </div>
          </details>
        )}
      </div>
    </Card>
  );
}
