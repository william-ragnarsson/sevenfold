"use client";

import { domainOf } from "@/lib/sources";
import type { CompetitiveLandscape, LandscapeCompany } from "@/lib/diligence/types";
import CompanyLogo from "./CompanyLogo";
import { GAPS, spreadPoints, type Point } from "./layout";

/**
 * The competitive landscape as a two-axis map: every company is a logo placed
 * by its x/y score, the startup ringed and highlighted. Each logo links to the
 * company's site, and hovering or focusing one shows what it does.
 *
 * Square on phones, 16:10 from `sm` up. Positions are percentages, so the map
 * reflows with its box; the axis end labels sit at the ends of the dashed
 * centre lines, the classic whiteboard quadrant layout. Logos are spread apart
 * twice, once for each grid shape, and CSS picks the layout, so nothing has
 * to be measured and the server renders the same map as the browser.
 */
export default function LandscapeGrid({ landscape }: { landscape: CompetitiveLandscape }) {
  const { xAxis, yAxis, companies } = landscape;
  const narrow = spreadPoints(companies, GAPS.narrow);
  const wide = spreadPoints(companies, GAPS.wide);

  return (
    <div>
      <div className="relative aspect-square rounded-2xl border border-ink/10 bg-white/40 sm:aspect-[16/10]">
        <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-ink/15" aria-hidden />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-ink/15" aria-hidden />

        <EndLabel className="left-1/2 top-2 -translate-x-1/2">↑ {yAxis.high}</EndLabel>
        <EndLabel className="bottom-2 left-1/2 -translate-x-1/2">↓ {yAxis.low}</EndLabel>
        <EndLabel className="left-2 top-1/2 -translate-y-1/2">← {xAxis.low}</EndLabel>
        <EndLabel className="right-2 top-1/2 -translate-y-1/2">{xAxis.high} →</EndLabel>

        {companies.map((company, i) => (
          <Marker key={`${company.name}-${i}`} company={company} narrow={narrow[i]} wide={wide[i]} />
        ))}
      </div>

      <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          <span className="text-ink/40">→</span> <span className="font-medium text-ink/70">{xAxis.label}</span>
        </span>
        <span>
          <span className="text-ink/40">↑</span> <span className="font-medium text-ink/70">{yAxis.label}</span>
        </span>
      </p>
    </div>
  );
}

function EndLabel({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`absolute max-w-[40%] truncate rounded bg-paper/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ink/50 sm:text-[11px] ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * One company on the map. The anchor sits at the exact point with no size of
 * its own; the logo centres on it and the name hangs underneath, so the
 * position is where the logo is, not where the logo-plus-label block is.
 */
function Marker({ company, narrow, wide }: { company: LandscapeCompany; narrow: Point; wide: Point }) {
  // y runs bottom-up on the chart, top-down in CSS.
  const position = {
    "--nx": `${narrow.x}%`,
    "--ny": `${100 - narrow.y}%`,
    "--wx": `${wide.x}%`,
    "--wy": `${100 - wide.y}%`,
  } as React.CSSProperties;
  const link = company.website ? { href: company.website, target: "_blank", rel: "noopener noreferrer" } : {};
  const Tag = company.website ? "a" : "div";
  const label = company.website ? `${company.name} (opens ${domainOf(company.website) ?? "website"})` : company.name;

  // Open the hover card away from the nearest edges so the card doesn't clip
  // it. Hovering is a pointer thing, so this follows the wide layout.
  const cardY = wide.y < 45 ? "bottom-7" : "top-7";
  const cardX = wide.x < 30 ? "left-[-1.25rem]" : wide.x > 70 ? "right-[-1.25rem]" : "left-0 -translate-x-1/2";

  return (
    <div
      className={`group absolute left-(--nx) top-(--ny) sm:left-(--wx) sm:top-(--wy) ${company.subject ? "z-20" : "z-10"} hover:z-30 focus-within:z-30`}
      style={position}
    >
      <Tag {...link} aria-label={label} className="block outline-none">
        <span
          className={`absolute left-0 top-0 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-150 group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-ink/50 ${
            company.subject ? "h-11 w-11 ring-2 ring-accent sm:h-12 sm:w-12" : "h-8 w-8 ring-1 ring-ink/12 sm:h-10 sm:w-10"
          }`}
        >
          <CompanyLogo company={company} className={company.subject ? "h-6 w-6 sm:h-7 sm:w-7" : "h-5 w-5 sm:h-6 sm:w-6"} />
          {company.rank && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[9px] font-semibold tabular-nums text-paper">
              {company.rank}
            </span>
          )}
        </span>
        <span
          className={`absolute left-0 -translate-x-1/2 whitespace-nowrap rounded px-1 text-[10px] leading-4 sm:text-[11px] ${
            company.subject
              ? "top-6 bg-marker font-semibold text-ink sm:top-7"
              : "top-4 max-w-[4.5rem] truncate bg-paper/70 font-medium text-ink/75 sm:top-5 sm:max-w-[8rem]"
          }`}
        >
          {company.name}
        </span>
      </Tag>

      {company.description && (
        <div
          className={`pointer-events-none absolute hidden w-56 rounded-xl border border-ink/10 bg-paper p-3 shadow-lg group-hover:block group-focus-within:block ${cardY} ${cardX}`}
          role="tooltip"
        >
          <p className="text-sm font-semibold text-ink">{company.name}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink/70">{company.description}</p>
          {company.website && (
            <p className="mt-1.5 font-mono text-[11px] text-accent">{domainOf(company.website)} ↗</p>
          )}
        </div>
      )}
    </div>
  );
}
