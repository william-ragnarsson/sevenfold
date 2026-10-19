"use client";

import { domainOf } from "@/lib/sources";
import type { CompetitiveLandscape, LandscapeAxis, LandscapeCompany } from "@/lib/diligence/types";
import CompanyLogo from "./CompanyLogo";
import { GAPS, spreadPoints, type Point } from "./layout";

/**
 * The competitive landscape as a two-axis chart: every company is a logo placed
 * by its x/y score, the startup ringed and named on a highlight, the ranked
 * competitors numbered. Each logo links to the company's site, and hovering or
 * focusing one shows what it does.
 *
 * The axes are labelled outside the plot, the way a chart is: the x axis
 * underneath, the y axis up the left side. Square on phones, wide from `sm`
 * up, 4:3 from `xl`, where it shares a row with the text that explains it.
 * Positions are percentages, so the plot reflows with its box. Logos are
 * spread apart twice, once for the square plot and once for the wide ones,
 * and CSS picks the layout, so nothing has to be measured and the server
 * renders the same chart as the browser.
 */
export default function LandscapeGrid({
  landscape,
  highlight = null,
  onHighlight,
}: {
  landscape: CompetitiveLandscape;
  /** Index into `landscape.companies` to pick out; the others fade. */
  highlight?: number | null;
  /** Called with a company's index as its logo is hovered, and null after. */
  onHighlight?: (index: number | null) => void;
}) {
  const { xAxis, yAxis, companies } = landscape;
  const narrow = spreadPoints(companies, GAPS.narrow);
  const wide = spreadPoints(companies, GAPS.wide);

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
      {/* Rotated so it reads bottom to top: low at the bottom, high at the top.
          Absolute, so long labels truncate to the plot's height instead of
          stretching the row. */}
      <div className="relative w-4">
        <div className="absolute inset-0 rotate-180 [writing-mode:vertical-rl]">
          <AxisLabels axis={yAxis} />
        </div>
      </div>

      <div className="relative aspect-square rounded-xl border border-ink/10 bg-white/50 sm:aspect-[16/10] md:aspect-[2/1] xl:aspect-[4/3]">
        <div className="absolute inset-y-0 left-1/2 border-l border-ink/[0.07]" aria-hidden />
        <div className="absolute inset-x-0 top-1/2 border-t border-ink/[0.07]" aria-hidden />

        {companies.map((company, i) => (
          <Marker
            key={`${company.name}-${i}`}
            company={company}
            narrow={narrow[i]}
            wide={wide[i]}
            highlighted={highlight === i}
            faded={highlight !== null && highlight !== i && !company.subject}
            onHover={onHighlight && ((on) => onHighlight(on ? i : null))}
          />
        ))}
      </div>

      <div aria-hidden />
      <AxisLabels axis={xAxis} />
    </div>
  );
}

/** "← low  LABEL  high →", the ends cut short before the label is. */
function AxisLabels({ axis }: { axis: LandscapeAxis }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-3 text-[11px] leading-4 text-ink/45">
      <span className="truncate" title={axis.low}>
        ← {axis.low}
      </span>
      <span className="truncate font-semibold uppercase tracking-[0.12em] text-ink/70" title={axis.label}>
        {axis.label}
      </span>
      <span className="truncate text-end" title={axis.high}>
        {axis.high} →
      </span>
    </div>
  );
}

/**
 * Three weights, so the eye lands on the startup first, then its closest
 * competitors, then everyone else.
 */
const TIERS = {
  subject: {
    bubble: "h-9 w-9 shadow-sm sm:h-10 sm:w-10",
    ring: "ring-2 ring-accent",
    logo: "h-5 w-5 sm:h-6 sm:w-6",
    name: "top-[1.375rem] max-w-[7rem] truncate bg-marker font-semibold text-ink sm:top-6 sm:max-w-[9rem]",
  },
  ranked: {
    bubble: "h-7 w-7 sm:h-8 sm:w-8",
    ring: "ring-1 ring-ink/15",
    logo: "h-4 w-4 sm:h-5 sm:w-5",
    name: "top-4 max-w-[5rem] truncate bg-white/70 font-medium text-ink/75 sm:top-[1.125rem] sm:max-w-[6rem]",
  },
  other: {
    bubble: "h-6 w-6 sm:h-7 sm:w-7",
    ring: "ring-1 ring-ink/10",
    logo: "h-4 w-4",
    name: "top-3.5 max-w-[5rem] truncate bg-white/70 text-ink/50 sm:top-4 sm:max-w-[6rem]",
  },
};

/**
 * Where a name sits against its logo. Centred, except near the left and right
 * edges, where it lines up with the logo's outer edge instead of hanging out
 * of the plot. One set of classes per layout, since a logo can be near the
 * edge in one and not the other.
 */
type Align = "start" | "center" | "end";
const alignOf = (x: number): Align => (x < 15 ? "start" : x > 85 ? "end" : "center");
const NAME_ALIGN = {
  narrow: {
    start: "left-[-0.75rem] translate-x-0",
    center: "left-0 -translate-x-1/2",
    end: "left-[0.75rem] -translate-x-full",
  },
  wide: {
    start: "sm:left-[-0.75rem] sm:translate-x-0",
    center: "sm:left-0 sm:-translate-x-1/2",
    end: "sm:left-[0.75rem] sm:-translate-x-full",
  },
} satisfies Record<string, Record<Align, string>>;

/**
 * One company on the map. The anchor sits at the exact point with no size of
 * its own; the logo centres on it and the name hangs underneath, so the
 * position is where the logo is, not where the logo-plus-label block is.
 */
function Marker({
  company,
  narrow,
  wide,
  highlighted,
  faded,
  onHover,
}: {
  company: LandscapeCompany;
  narrow: Point;
  wide: Point;
  highlighted: boolean;
  faded: boolean;
  onHover?: (on: boolean) => void;
}) {
  // y runs bottom-up on the chart, top-down in CSS.
  const position = {
    "--nx": `${narrow.x}%`,
    "--ny": `${(100 - narrow.y).toFixed(2)}%`,
    "--wx": `${wide.x}%`,
    "--wy": `${(100 - wide.y).toFixed(2)}%`,
  } as React.CSSProperties;
  const link = company.website ? { href: company.website, target: "_blank", rel: "noopener noreferrer" } : {};
  const Tag = company.website ? "a" : "div";
  const label = company.website ? `${company.name} (opens ${domainOf(company.website) ?? "website"})` : company.name;
  const tier = company.subject ? TIERS.subject : company.rank ? TIERS.ranked : TIERS.other;

  // Open the hover card away from the nearest edges so the card doesn't clip
  // it. Hovering is a pointer thing, so this follows the wide layout.
  const cardY = wide.y < 45 ? "bottom-6" : "top-6";
  const cardX = wide.x < 30 ? "left-[-1.25rem]" : wide.x > 70 ? "right-[-1.25rem]" : "left-0 -translate-x-1/2";

  return (
    <div
      className={`group absolute left-(--nx) top-(--ny) transition-opacity duration-150 sm:left-(--wx) sm:top-(--wy) ${
        highlighted ? "z-30" : company.subject ? "z-20" : "z-10"
      } ${faded ? "opacity-30" : ""} hover:z-30 focus-within:z-30`}
      style={position}
      onMouseEnter={onHover && (() => onHover(true))}
      onMouseLeave={onHover && (() => onHover(false))}
    >
      <Tag {...link} aria-label={label} className="block outline-none">
        <span
          className={`absolute left-0 top-0 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white transition-transform duration-150 group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-ink/50 ${
            tier.bubble
          } ${highlighted && !company.subject ? "scale-110 ring-2 ring-ink/40" : tier.ring}`}
        >
          <CompanyLogo company={company} className={tier.logo} />
          {company.rank && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[9px] font-semibold tabular-nums text-paper">
              {company.rank}
            </span>
          )}
        </span>
        <span
          className={`absolute whitespace-nowrap rounded px-1 text-[10px] leading-4 sm:text-[11px] ${tier.name} ${
            NAME_ALIGN.narrow[alignOf(narrow.x)]
          } ${NAME_ALIGN.wide[alignOf(wide.x)]}`}
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
