"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AnalysisState } from "@/lib/diligence/stream-state";
import { readField } from "@/lib/diligence/form-schema";
import type { ProductSlug } from "@/lib/products";
import { clip, pages, RATINGS, ratingOf } from "./RunLog";
import VerdictLine from "./VerdictLine";

/**
 * The analysis on one page: the call, the ratings behind it, the memo's key
 * facts, the closest competitors and what to fix first in the deck. Each block
 * glimpses one page and links there for the rest. While the run is live, a
 * block with nothing yet pulses; after it, the block says what's missing.
 */
export default function SummaryView({
  state,
  active,
  pageHref,
}: {
  state: AnalysisState;
  active: boolean;
  pageHref: (slug: ProductSlug) => string;
}) {
  const results = pageHref("results");
  const description = known(state, "company.description");

  return (
    <div className="max-w-[680px] divide-y divide-ink/10 border-t border-ink/10">
      <div className="py-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[15px]">
          {state.verdict ? (
            <VerdictLine verdict={state.verdict} />
          ) : active ? (
            <Pending />
          ) : (
            <span className="text-muted">No verdict in this report</span>
          )}
          <LinkOut href={`${results}#verdict`} label="Results" />
        </div>
        {description && <p className="mt-2 text-sm leading-[22px] text-ink/75">{clip(description, 220)}</p>}
      </div>

      <Block title="Ratings" link={<LinkOut href={`${results}#scorecard`} label="Results" />}>
        <Ratings state={state} active={active} />
      </Block>

      <Block title="Key facts" link={<LinkOut href={pageHref("memo")} label="Memo" />}>
        <KeyFacts state={state} active={active} />
      </Block>

      {/* Reports from before the landscape have no slice for it, so no block. */}
      {(state.landscape !== undefined || state.landscapeError) && (
        <Block title="Closest competitors" link={<LinkOut href={pageHref("landscape")} label="Landscape" />}>
          <Competitors state={state} active={active} />
        </Block>
      )}

      <Block title="Fix first in the deck" link={<LinkOut href={`${results}#feedback`} label="Results" />}>
        <FixFirst state={state} active={active} />
      </Block>
    </div>
  );
}

function Block({ title, link, children }: { title: string; link: ReactNode; children: ReactNode }) {
  return (
    <div className="py-6">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-[15px] leading-[22px] font-semibold text-ink">{title}</h2>
        {link}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function LinkOut({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-[13px] text-ink/60 transition-colors hover:text-ink">
      {label} →
    </Link>
  );
}

/** Where a block's lines will land, while the run is still on its way to them. */
function Pending() {
  return <span aria-hidden className="inline-block h-3 w-48 max-w-full animate-pulse rounded bg-ink/10 align-middle" />;
}

function Missing({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

/** A label and its value, the labels lined up in one column down the page. */
function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-x-4 py-1 text-sm leading-[22px] sm:grid-cols-[128px_1fr]">
      <dt className="min-w-0 break-words text-ink/60">{label}</dt>
      <dd className="min-w-0 break-words text-ink/75">{children}</dd>
    </div>
  );
}

function Ratings({ state, active }: { state: AnalysisState; active: boolean }) {
  const rated = RATINGS.map((r) => ({ ...r, n: Math.min(5, ratingOf(state, r.key)) }));
  if (!rated.some((r) => r.n > 0)) return active ? <Pending /> : <Missing>Not scored in this report</Missing>;
  return (
    <ul className="grid gap-x-10 sm:grid-cols-2">
      {rated.map(({ key, label, n }) => (
        <li key={key} className="flex items-center justify-between gap-4 py-1 text-sm leading-[22px] text-ink/75">
          <span className="min-w-0">{label}</span>
          <span aria-hidden className="flex shrink-0 gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= n ? "bg-ink/80" : "bg-ink/15"}`} />
            ))}
          </span>
          <span className="sr-only">{n > 0 ? `${n} of 5` : "not scored"}</span>
        </li>
      ))}
    </ul>
  );
}

/** A memo cell's value, or "" when it's empty or the model only said it doesn't know (often as the word itself). */
function known(state: AnalysisState, key: string): string {
  const field = readField(state.form, key);
  return field && field.source !== "unknown" ? field.value : "";
}

function KeyFacts({ state, active }: { state: AnalysisState; active: boolean }) {
  const founders = state.form.founders.members
    .filter((m) => m.name)
    .map((m) => (m.role ? `${m.name} (${m.role})` : m.name))
    .join(", ");
  const facts = [
    { label: "Problem", value: known(state, "problem.core") },
    { label: "Solution", value: known(state, "solution.core") },
    { label: "Traction", value: known(state, "market.traction") },
    // The founders by name, or how big the team is when the deck names none.
    { label: "Team", value: founders || known(state, "team.headcount") },
  ].filter((f) => f.value);
  if (!facts.length) return active ? <Pending /> : <Missing>Nothing in the memo</Missing>;
  return (
    <dl>
      {facts.map((f) => (
        <Fact key={f.label} label={f.label}>
          {clip(f.value, 200)}
        </Fact>
      ))}
    </dl>
  );
}

function Competitors({ state, active }: { state: AnalysisState; active: boolean }) {
  const map = state.landscape;
  if (!map) {
    if (state.landscapeError) return <Missing>The competitors couldn’t be mapped</Missing>;
    return active ? <Pending /> : <Missing>Didn’t finish</Missing>;
  }
  const top = map.companies
    .filter((c) => !c.subject)
    .sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9))
    .slice(0, 3);
  if (!top.length) return <Missing>No competitors turned up</Missing>;
  return (
    <dl>
      {top.map((c, i) => (
        <Fact key={`${c.name}-${i}`} label={<span className="text-ink">{c.name}</span>}>
          {clip(c.description, 160)}
        </Fact>
      ))}
    </dl>
  );
}

function FixFirst({ state, active }: { state: AnalysisState; active: boolean }) {
  const items = state.deckFeedback;
  if (!items.length) return active ? <Pending /> : <Missing>No feedback in this report</Missing>;
  const worst = [
    ...items.filter((f) => f.severity === "critical"),
    ...items.filter((f) => f.severity === "warning"),
  ].slice(0, 3);
  if (!worst.length) {
    if (active) return <Pending />;
    // Strengths alone mean nothing to fix only once the feedback got to its end, which the verdict waits for.
    return <Missing>{state.verdict ? "Nothing critical or to warn about" : "Didn’t finish"}</Missing>;
  }
  return (
    <dl>
      {worst.map((item, i) => {
        const slides = pages(item.slides);
        return (
          <Fact
            key={i}
            label={
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.severity === "critical" ? "bg-red-600" : "bg-amber-500"}`}
                />
                {item.severity === "critical" ? "Critical" : "Warning"}
              </span>
            }
          >
            {item.title}
            {slides && <span className="text-xs text-ink/60 tabular-nums"> · {slides}</span>}
          </Fact>
        );
      })}
    </dl>
  );
}
