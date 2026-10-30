"use client";

import Link from "next/link";
import type { AnalysisState } from "@/lib/diligence/stream-state";
import { DOC_SECTIONS, FIELD_DESCRIPTORS, readField, SCORECARD_METRIC_KEYS, sectionSlug } from "@/lib/diligence/form-schema";
import { citedSlides } from "@/lib/diligence/evidence";
import { formatGauge } from "@/lib/invest/gauge";
import { domainOf } from "@/lib/sources";
import { analysisPath, deckSlidePath } from "@/lib/routes";
import { formatElapsed } from "./elapsed";
import { tabAbsent } from "./productTabs";

/**
 * The run as it happens, top to bottom: one chapter per stage, in the order the
 * work reads, each with a few lines of what it found so far. Every line links
 * to the page that holds the full thing; the log itself only glimpses.
 *
 * A chapter's status comes from `state.stages`. Reports saved before stages
 * were tracked have none, so there a chapter is done when its product left
 * something, and otherwise wasn't in the report.
 */

export type ChapterStatus = "waiting" | "working" | "done" | "failed" | "stopped" | "skipped" | "absent";

type LeadTone = "accent" | "critical" | "warning" | "strength";

interface Line {
  key: string;
  /** The short word in the left column: a page, a source, a severity. */
  lead?: string;
  leadTone?: LeadTone;
  /** The lead only draws what the aside says (a rating's dots), so screen readers skip it. */
  leadHidden?: boolean;
  /** A darker prefix before the text, e.g. a field's label. */
  label?: string;
  text: string;
  /** Right-hand note: slides, a domain, a count. Only screen readers get it on phones. */
  aside?: string;
  tone?: "muted" | "fail" | "note";
  href: string;
}

interface Chapter {
  /** The stage id `state.stages` keys it by. */
  id: string;
  title: string;
  /** What it waits on, shown until it starts. */
  after: string;
  link: { label: string; href: (id: string) => string };
  /** For reports with no `stages`: whether this chapter left anything. */
  has: (s: AnalysisState) => boolean;
  lines: (s: AnalysisState, id: string, status: ChapterStatus) => Line[];
  /** Always shown under the lines, past the window. */
  footer?: (s: AnalysisState, id: string, status: ChapterStatus) => Line | null;
  counts?: (s: AnalysisState, lines: Line[]) => string | null;
}

/** Most lines a chapter shows; the rest are a link away. */
const WINDOW = 6;

export const RATINGS = SCORECARD_METRIC_KEYS.map((key) => ({
  key,
  label: FIELD_DESCRIPTORS.find((f) => f.key === `scorecard.${key}`)?.label ?? key,
}));

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, strength: 2 };

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** One line of `text`, cut at the last whole word that fits in `max`. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  // A single long word has nowhere to break, so it's cut mid-word.
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, "")}…`;
}

/** The first line of a slide's text with any markdown lead-in stripped. */
function firstLine(text: string): string {
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^[\s#*>•-]+/, "").replace(/\*\*/g, "").trim();
    if (line) return clip(line, 120);
  }
  return "";
}

/** "p.3, 4, 7", capped at four pages. */
export function pages(list: number[] | undefined): string | undefined {
  if (!list?.length) return undefined;
  const shown = list.slice(0, 4).join(", ");
  return list.length > 4 ? `p.${shown} +${list.length - 4}` : `p.${shown}`;
}

/** The latest whole thought in research's notes: its last real sentence, plain. */
function lastThought(notes: string): string {
  const lines = notes
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("|") && !/^([-*_])\1{2,}$/.test(l));
  const pick = lines.findLast((l) => l.length >= 40) ?? lines.at(-1);
  if (!pick) return "";
  const plain = pick
    .replace(/^([-*•]|\d+[.)])\s+/, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*?/g, "");
  return clip(plain, 200);
}

/** Every text cell of the memo that a deck or web can fill, with where it sits on the memo page. */
const MEMO_CELLS = DOC_SECTIONS.flatMap((section) =>
  section.fields
    .filter((f) => !f.manualOnly)
    .map((f) => ({ ...f, anchor: sectionSlug(section.title) })),
);

function memoLines(s: AnalysisState, id: string, sources: string[]): Line[] {
  const cited = citedSlides({ deck: s.deck, form: s.form });
  const out: Line[] = [];
  for (const f of MEMO_CELLS) {
    if (f.kind === "founders") {
      const members = s.form.founders.members.filter((m) => sources.includes(m.source ?? "deck") && m.name);
      if (members.length)
        out.push({
          key: f.key,
          lead: members[0].source ?? "deck",
          label: f.label,
          text: members.map((m) => m.name).join(", "),
          aside: sources.includes("deck") ? pages(cited[f.key]) : undefined,
          href: analysisPath(id, "founders"),
        });
      continue;
    }
    const cell = readField(s.form, f.key);
    if (!cell?.value || !sources.includes(cell.source)) continue;
    out.push({
      key: f.key,
      lead: cell.source,
      label: f.label,
      text: clip(cell.value, 240),
      aside: cell.source === "deck" ? pages(cited[f.key]) : undefined,
      href: `${analysisPath(id, "memo")}#${f.anchor}`,
    });
  }
  return out;
}

export function ratingOf(s: AnalysisState, key: (typeof SCORECARD_METRIC_KEYS)[number]): number {
  return Math.round(s.form.scorecard[key] || 0);
}

export const CHAPTERS: Chapter[] = [
  {
    id: "deck",
    title: "Reading the deck",
    after: "Up first",
    link: { label: "Deck", href: (id) => analysisPath(id, "deck") },
    has: (s) => s.deck !== undefined,
    lines: (s, id) => {
      const deck = s.deck;
      if (!deck) return [];
      if (!deck.slides.length && deck.unassigned)
        return [{ key: "all", lead: "text", text: firstLine(deck.unassigned), href: analysisPath(id, "deck") }];
      return deck.slides
        .map((slide) => ({ slide, text: firstLine(slide.text) }))
        .filter(({ text }) => text)
        .map(({ slide, text }) => ({ key: `p${slide.index}`, lead: `p.${slide.index}`, text, href: deckSlidePath(id, slide.index) }));
    },
    counts: (s) => {
      if (!s.deck) return null;
      return s.deck.pageCount ? plural(s.deck.pageCount, "page") : plural(s.deck.slides.length, "slide");
    },
  },
  {
    id: "extract",
    title: "Drafting the memo from the deck",
    after: "After the deck",
    link: { label: "Memo", href: (id) => analysisPath(id, "memo") },
    has: (s) => MEMO_CELLS.some((f) => readField(s.form, f.key)?.value),
    lines: (s, id) => memoLines(s, id, ["deck"]),
    footer: (s, id, status) => {
      if (status !== "done") return null;
      const missing = MEMO_CELLS.filter((f) => {
        if (f.kind === "founders") return !s.form.founders.members.some((m) => (m.source ?? "deck") === "deck");
        const cell = readField(s.form, f.key);
        return cell ? cell.source !== "deck" && cell.source !== "personal" : false;
      }).map((f) => f.label);
      if (!missing.length) return null;
      const named = missing.slice(0, 4).join(", ");
      const rest = missing.length - 4;
      return {
        key: "missing",
        lead: "gaps",
        text: `Not from the deck in the memo: ${named}${rest > 0 ? ` and ${rest} more` : ""}`,
        tone: "muted",
        href: analysisPath(id, "memo"),
      };
    },
    // Both read the memo as it stands: research can correct a deck value, and
    // nothing saved says which fields extract itself filled.
    counts: (_s, lines) => `${plural(lines.length, "field")} from the deck`,
  },
  {
    id: "research",
    title: "Researching what the deck leaves out",
    after: "After the memo draft",
    link: { label: "Sources", href: (id) => `${analysisPath(id, "memo")}#sources` },
    has: (s) => s.searches.length > 0 || Boolean(s.notes),
    lines: (s, id) => {
      const href = `${analysisPath(id, "memo")}#sources`;
      return s.searches.flatMap((group, i) => {
        const first = group.sources[0];
        const rows: Line[] = [
          {
            key: `q${i}`,
            lead: "search",
            text: group.query,
            aside: group.sources.length ? plural(group.sources.length, "source") : undefined,
            href,
          },
        ];
        if (first)
          rows.push({
            key: `q${i}s`,
            text: first.title || domainOf(first.url) || first.url,
            aside: domainOf(first.url) ?? undefined,
            tone: "muted",
            href,
          });
        return rows;
      });
    },
    footer: (s, id) => {
      const thought = lastThought(s.notes);
      return thought ? { key: "note", text: thought, tone: "note", href: `${analysisPath(id, "memo")}#sources` } : null;
    },
    counts: (s) =>
      s.searches.length || s.sourceCount
        ? `${plural(s.searches.length, "search", "searches")} · ${plural(s.sourceCount, "source")}`
        : null,
  },
  {
    id: "landscape",
    title: "Mapping the competition",
    after: "After the memo draft",
    link: { label: "Landscape", href: (id) => analysisPath(id, "landscape") },
    has: (s) => s.landscape != null,
    lines: (s, id) => {
      const href = analysisPath(id, "landscape");
      const out: Line[] = [];
      if (s.landscapeError) out.push({ key: "error", lead: "error", text: s.landscapeError, tone: "fail", href });
      const map = s.landscape;
      if (map) {
        out.push({ key: "axes", lead: "map", text: `${map.xAxis.label} against ${map.yAxis.label}`, href });
        map.companies
          .filter((c) => !c.subject)
          .sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9))
          .forEach((c, i) =>
            out.push({
              key: `c${i}`,
              lead: c.rank ? `#${c.rank}` : undefined,
              label: c.name,
              text: c.description,
              aside: domainOf(c.website) ?? undefined,
              href,
            }),
          );
      } else {
        (s.landscapeSearches ?? []).forEach((group, i) =>
          out.push({
            key: `q${i}`,
            lead: "search",
            text: group.query,
            aside: group.sources.length ? plural(group.sources.length, "source") : undefined,
            href,
          }),
        );
      }
      return out;
    },
    counts: (s) => (s.landscape ? plural(s.landscape.companies.filter((c) => !c.subject).length, "competitor") : null),
  },
  {
    id: "complete",
    title: "Filling the gaps from the web",
    after: "After research",
    link: { label: "Memo", href: (id) => analysisPath(id, "memo") },
    has: (s) =>
      s.phase === "done" ||
      MEMO_CELLS.some((f) => {
        const source = readField(s.form, f.key)?.source;
        return source === "web" || source === "inferred";
      }),
    lines: (s, id) => memoLines(s, id, ["web", "inferred"]),
    counts: (_s, lines) => `${plural(lines.length, "field")} filled`,
  },
  {
    id: "scorecard",
    title: "Scoring against your playbook",
    after: "After the memo is complete",
    link: { label: "Results", href: (id) => `${analysisPath(id, "results")}#scorecard` },
    has: (s) => RATINGS.some((r) => ratingOf(s, r.key) > 0),
    lines: (s, id) => {
      const href = `${analysisPath(id, "results")}#scorecard`;
      const out: Line[] = RATINGS.filter((r) => ratingOf(s, r.key) > 0).map((r) => {
        const n = Math.min(5, ratingOf(s, r.key));
        return { key: r.key, lead: "●".repeat(n) + "○".repeat(5 - n), leadHidden: true, text: r.label, aside: `${n} of 5`, href };
      });
      const funding = s.form.scorecard.funding;
      if (s.fundingInUsd && funding !== null)
        out.push({
          key: "funding",
          lead: "raised",
          text: funding === 0 ? "Nothing raised yet" : `$${funding.toLocaleString("en-US")}`,
          href,
        });
      return out;
    },
    counts: (s) => {
      const rated = RATINGS.map((r) => ratingOf(s, r.key)).filter((n) => n > 0);
      if (!rated.length) return null;
      return `average ${(rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(1)} of 5`;
    },
  },
  {
    id: "feedback",
    title: "Reading the deck as a pitch",
    after: "After the scores",
    link: { label: "Results", href: (id) => `${analysisPath(id, "results")}#feedback` },
    has: (s) => Boolean(s.deckFeedback?.length),
    lines: (s, id, status) => {
      const href = `${analysisPath(id, "results")}#feedback`;
      const items = (s.deckFeedback ?? []).map((item, i) => ({ item, i }));
      // Arrival order while it writes, so new items land at the bottom; worst first once done.
      if (status !== "working")
        items.sort((a, b) => (SEVERITY_ORDER[a.item.severity] ?? 3) - (SEVERITY_ORDER[b.item.severity] ?? 3));
      return items.map(({ item, i }) => ({
        key: `f${i}`,
        lead: item.severity,
        leadTone: item.severity,
        text: item.title,
        aside: pages(item.slides),
        href,
      }));
    },
    counts: (s) => {
      const items = s.deckFeedback ?? [];
      const count = (severity: string) => items.filter((f) => f.severity === severity).length;
      const parts = [
        [count("critical"), "critical", "critical"],
        [count("warning"), "warning", "warnings"],
        [count("strength"), "strength", "strengths"],
      ] as const;
      const said = parts.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many));
      return said.length ? said.join(" · ") : null;
    },
  },
  {
    id: "verdict",
    title: "Verdict",
    after: "After the review",
    link: { label: "Results", href: (id) => `${analysisPath(id, "results")}#verdict` },
    has: (s) => s.verdict != null,
    lines: (s, id) => {
      const v = s.verdict;
      const href = `${analysisPath(id, "results")}#verdict`;
      if (!v) return [];
      if (!v.available) return [{ key: "v", lead: "n/a", text: v.note || "The model couldn't run", tone: "muted", href }];
      const base = { key: "v", lead: v.invest ? "invest" : "pass", leadTone: v.invest ? ("accent" as const) : undefined, href };
      if (v.score !== undefined && v.threshold !== undefined) {
        const gauge = formatGauge(v.score, v.threshold);
        return [{ ...base, text: `${gauge.score} out of 100`, aside: `gate ${gauge.gate}` }];
      }
      if (v.probability !== undefined) return [{ ...base, text: `${Math.round(v.probability * 100)}% likely to invest` }];
      return [{ ...base, text: v.invest ? "Invest" : "Pass" }];
    },
  },
];

export function chapterStatus(chapter: Chapter, s: AnalysisState, active: boolean, stopped: boolean): ChapterStatus {
  if (!s.stages) {
    if (chapter.id === "landscape" && s.landscapeError) return "failed";
    if (chapter.has(s)) return "done";
    // As the sidebar reads it: a run that stopped didn't finish what it left
    // empty, unless the report predates the product.
    const predates = (chapter.id === "deck" || chapter.id === "landscape") && tabAbsent(chapter.id, s);
    return stopped && !predates ? "stopped" : "absent";
  }
  const timing = s.stages[chapter.id];
  if (!timing) return active ? "waiting" : "skipped";
  if (timing.failed) return "failed";
  if (timing.end !== undefined) return "done";
  return active ? "working" : "stopped";
}

const STARTED: ChapterStatus[] = ["working", "done", "failed", "stopped"];

const DOT: Record<ChapterStatus, string> = {
  waiting: "border border-ink/35 bg-paper",
  working: "bg-accent",
  done: "bg-ink",
  failed: "bg-red-500",
  stopped: "border-[1.5px] border-red-500 bg-paper",
  skipped: "border border-ink/35 bg-paper",
  absent: "border border-ink/35 bg-paper",
};

const LEAD_TONE: Record<LeadTone, string> = {
  accent: "text-accent",
  critical: "text-red-700",
  warning: "text-amber-700",
  strength: "text-accent",
};

function metaOf(chapter: Chapter, s: AnalysisState, status: ChapterStatus, lines: Line[]): { text: string; tone: string } {
  switch (status) {
    case "waiting":
      return { text: chapter.after, tone: "text-ink/60" };
    case "working":
      return { text: "Working", tone: "text-accent" };
    case "failed":
      return { text: "Failed", tone: "text-red-700" };
    case "stopped":
      return { text: "Didn't finish", tone: "text-red-700" };
    case "skipped":
      return { text: "Didn't run", tone: "text-ink/60" };
    case "absent":
      return { text: "Not in this report", tone: "text-ink/60" };
    case "done": {
      const timing = s.stages?.[chapter.id];
      const took =
        timing?.start !== undefined && timing.end !== undefined
          ? timing.end - timing.start < 1000
            ? "<1s"
            : formatElapsed(timing.end - timing.start)
          : null;
      const text = [took, chapter.counts?.(s, lines)].filter(Boolean).join(" · ");
      return { text: text || "Done", tone: "text-ink/60" };
    }
  }
}

function LogLine({ line }: { line: Line }) {
  if (line.tone === "note")
    return (
      <li className="grid grid-cols-[60px_1fr] gap-x-3 pt-2 sm:grid-cols-[68px_1fr]">
        <span aria-hidden />
        <Link
          href={line.href}
          className="min-w-0 border-l-2 border-ink/10 pl-3 text-sm leading-relaxed break-words text-ink/60 transition-colors hover:text-ink"
        >
          {line.text}
        </Link>
      </li>
    );
  const textTone = line.tone === "muted" ? "text-ink/60" : line.tone === "fail" ? "text-red-700" : "text-ink/75";
  return (
    <li>
      <Link
        href={line.href}
        className="group grid grid-cols-[60px_1fr] gap-x-3 rounded-sm py-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:animate-[fade-in-soft_0.5s_ease_both] sm:grid-cols-[68px_1fr_auto]"
      >
        <span
          aria-hidden={line.leadHidden || undefined}
          className={`truncate text-xs leading-[22px] tabular-nums ${line.leadTone ? LEAD_TONE[line.leadTone] : "text-ink/60"}`}
        >
          {line.lead}
        </span>
        <span
          className={`line-clamp-2 text-sm leading-[22px] break-words decoration-ink/25 underline-offset-[3px] transition-colors group-hover:text-ink group-hover:underline ${textTone}`}
        >
          {line.label && <span className="text-ink">{line.label}: </span>}
          {line.text}
        </span>
        {line.aside && (
          <span className="sr-only text-xs leading-[22px] text-ink/60 tabular-nums sm:not-sr-only sm:whitespace-nowrap">
            {line.aside}
          </span>
        )}
      </Link>
    </li>
  );
}

function MoreLine({ text, href }: { text: string; href: string }) {
  return (
    <li>
      <Link
        href={href}
        className="grid grid-cols-[60px_1fr] gap-x-3 py-0.5 text-xs leading-[22px] text-ink/60 transition-colors hover:text-ink sm:grid-cols-[68px_1fr]"
      >
        <span aria-hidden />
        <span>{text}</span>
      </Link>
    </li>
  );
}

function ChapterItem({
  chapter,
  status,
  state,
  id,
  last,
}: {
  chapter: Chapter;
  status: ChapterStatus;
  state: AnalysisState;
  id: string;
  last: boolean;
}) {
  const started = STARTED.includes(status);
  const lines = started ? chapter.lines(state, id, status) : [];
  const footer = started ? chapter.footer?.(state, id, status) : null;
  const meta = metaOf(chapter, state, status, lines);
  const href = chapter.link.href(id);

  // While it works, the newest lines; once it's settled, the first ones. A
  // "more" line would take the room of the one line it hid, so one over shows.
  let shown = lines;
  let before = 0;
  let after = 0;
  if (lines.length > WINDOW + 1) {
    if (status === "working") {
      before = lines.length - WINDOW;
      shown = lines.slice(before);
    } else {
      after = lines.length - WINDOW;
      shown = lines.slice(0, WINDOW);
    }
  }

  return (
    <li className="relative grid grid-cols-[20px_1fr] gap-x-4">
      {!last && <span aria-hidden className="absolute top-[11px] -bottom-[11px] left-[9.5px] w-px bg-ink/12" />}
      <span aria-hidden className={`relative mt-[7px] block h-2 w-2 justify-self-center rounded-full ${DOT[status]}`}>
        {status === "working" && <span className="absolute inset-0 rounded-full bg-accent motion-safe:animate-ping" />}
      </span>
      <div className="min-w-0 pb-7">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className={`text-[15px] leading-[22px] font-semibold ${started ? "text-ink" : "text-ink/60"}`}>{chapter.title}</h2>
          {started && (
            <Link href={href} className="text-[13px] text-ink/60 transition-colors hover:text-ink">
              {chapter.link.label} →
            </Link>
          )}
        </div>
        <p className={`text-[13px] leading-5 tabular-nums ${meta.tone}`}>{meta.text}</p>
        {(shown.length > 0 || footer || status === "working") && (
          <ul className="mt-2">
            {before > 0 && <MoreLine text={`↑ ${before} earlier`} href={href} />}
            {shown.map((line) => (
              <LogLine key={line.key} line={line} />
            ))}
            {after > 0 && <MoreLine text={`${after} more →`} href={href} />}
            {status === "working" && (
              <li aria-hidden className="grid grid-cols-[60px_1fr] gap-x-3 py-0.5 sm:grid-cols-[68px_1fr]">
                <span />
                <span className="mt-[5px] block h-3 w-1.5 animate-blink bg-accent" />
              </li>
            )}
            {footer && <LogLine line={footer} />}
          </ul>
        )}
      </div>
    </li>
  );
}

export default function RunLog({
  id,
  state,
  statuses,
}: {
  id: string;
  state: AnalysisState;
  /** One per `CHAPTERS` entry, from `chapterStatus`. */
  statuses: ChapterStatus[];
}) {
  return (
    <ol aria-label="How the analysis ran">
      {CHAPTERS.map((chapter, i) => (
        <ChapterItem
          key={chapter.id}
          chapter={chapter}
          status={statuses[i]}
          state={state}
          id={id}
          last={i === CHAPTERS.length - 1}
        />
      ))}
    </ol>
  );
}
