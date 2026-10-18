"use client";

import Card from "@/components/ui/Card";
import { SearchList, SourceRow } from "@/components/report/Sources";
import type { SearchGroup } from "@/lib/diligence/stream-state";
import type { CompetitiveLandscape, LandscapeAxis, LandscapeCompany } from "@/lib/diligence/types";
import CompanyLogo from "./CompanyLogo";
import LandscapeGrid from "./LandscapeGrid";

/**
 * Where the startup sits among its competitors: the two axes the model judged
 * most decisive for this market, every company plotted on them, and underneath
 * the reasoning — why these axes, who the closest competitors are and how the
 * startup differs from each.
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

function AxisCard({ direction, axis }: { direction: string; axis: LandscapeAxis }) {
  return (
    <div className="cell-pop rounded-xl border border-ink/10 bg-white/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">{direction}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{axis.label}</p>
      <p className="mt-0.5 text-xs text-muted">
        {axis.low} → {axis.high}
      </p>
      {axis.why && <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{axis.why}</p>}
    </div>
  );
}

function CompetitorCard({ company, subjectName }: { company: LandscapeCompany; subjectName: string }) {
  return (
    <div className="cell-pop rounded-xl border border-ink/10 bg-white/50 p-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold tabular-nums text-paper">
          {company.rank}
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-ink/10">
          <CompanyLogo company={company} className="h-5 w-5" />
        </span>
        <CompanyName company={company} className="min-w-0 truncate text-sm font-semibold text-ink" />
      </div>
      {company.description && <p className="mt-2 text-sm leading-relaxed text-ink/70">{company.description}</p>}
      {company.whyCompetitor && (
        <div className="mt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">Why they compete</p>
          <p className="mt-0.5 text-sm leading-relaxed text-ink/70">{company.whyCompetitor}</p>
        </div>
      )}
      {company.contrast && (
        <div className="mt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">How {subjectName} differs</p>
          <p className="mt-0.5 text-sm leading-relaxed text-ink/70">{company.contrast}</p>
        </div>
      )}
    </div>
  );
}

function CompanyChip({ company }: { company: LandscapeCompany }) {
  const body = (
    <>
      <CompanyLogo company={company} className="h-4 w-4" />
      <span className="truncate">{company.name}</span>
    </>
  );
  const className =
    "flex max-w-full items-center gap-1.5 rounded-full border border-ink/10 bg-white/50 px-2.5 py-1 text-xs font-medium text-ink/75";
  if (!company.website) return <span className={className}>{body}</span>;
  return (
    <a
      href={company.website}
      target="_blank"
      rel="noopener noreferrer"
      title={company.description || undefined}
      className={`${className} transition-colors hover:border-ink/25 hover:text-ink`}
    >
      {body}
    </a>
  );
}

function Skeleton() {
  return (
    <div className="px-5 pb-5">
      <div className="flex aspect-square animate-pulse items-center justify-center rounded-2xl border border-ink/10 bg-ink/[0.04] sm:aspect-[16/10]">
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
  if (!landscape && !error && !active) return null;
  if (!landscape) {
    return (
      <Card eyebrow="Competitive landscape" className="fade-up">
        {error ? <Failed message={error} /> : <Working searches={searches} />}
      </Card>
    );
  }

  const subject = landscape.companies.find((c) => c.subject);
  const subjectName = subject?.name || "the startup";
  const top = landscape.companies.filter((c) => c.rank !== null).sort((a, b) => a.rank! - b.rank!);
  const rest = landscape.companies.filter((c) => !c.subject && c.rank === null);

  return (
    <Card eyebrow="Competitive landscape" className="fade-up">
      <div className="space-y-6 px-5 pb-5">
        {landscape.summary && <p className="max-w-3xl text-sm leading-relaxed text-ink/80">{landscape.summary}</p>}

        <LandscapeGrid landscape={landscape} />

        <div>
          <Subhead>Why these axes</Subhead>
          <div className="grid gap-2 sm:grid-cols-2">
            <AxisCard direction="Horizontal" axis={landscape.xAxis} />
            <AxisCard direction="Vertical" axis={landscape.yAxis} />
          </div>
        </div>

        {top.length > 0 && (
          <div>
            <Subhead>Top competitors</Subhead>
            <div className="grid gap-2 sm:grid-cols-3">
              {top.map((company, i) => (
                <CompetitorCard key={`${company.name}-${i}`} company={company} subjectName={subjectName} />
              ))}
            </div>
          </div>
        )}

        {rest.length > 0 && (
          <div>
            <Subhead>Also on the map</Subhead>
            <div className="flex flex-wrap gap-1.5">
              {rest.map((company, i) => (
                <CompanyChip key={`${company.name}-${i}`} company={company} />
              ))}
            </div>
          </div>
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
