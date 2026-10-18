import { getProvider } from "@/lib/llm";
import { deriveProvider, getResearchMaxSearches } from "@/lib/config";
import { costOf } from "@/lib/llm/pricing";
import {
  buildLandscapeMapSystemPrompt,
  buildLandscapeMapUserPrompt,
  buildLandscapeResearchSystemPrompt,
  buildLandscapeResearchUserPrompt,
} from "@/lib/diligence/prompt";
import { cleanDashes, extractObject } from "./parse";
import type {
  CompetitiveLandscape,
  DueDiligenceForm,
  LandscapeAxis,
  LandscapeCompany,
  ProgressCallback,
  Source,
} from "./types";

interface LandscapeArgs {
  /** Concrete model id to run on; provider is derived from the name. */
  model: string;
  deckText: string;
  playbook: string;
  /** The startup's name from the deck pass ("" if the deck didn't say). */
  companyName: string;
  /** The form to write the landscape onto. */
  form: DueDiligenceForm;
  emit: ProgressCallback;
  /** Aborts the underlying requests — cancel/disconnect stops token burn. */
  signal?: AbortSignal;
}

/** Competitors kept on the grid, besides the startup; more turns it into noise. */
const MAX_COMPETITORS = 10;

/** The model answered, but not with a map we could read. */
class UnreadableMap extends Error {}

/**
 * Why the landscape couldn't be built, in words fit for the report. Provider
 * SDK errors carry the HTTP status; the raw message stays in the server log.
 */
export function landscapeFailure(err: unknown): string {
  const status = typeof err === "object" && err !== null && "status" in err ? err.status : undefined;
  if (status === 401 || status === 403) return "The model provider rejected the API key.";
  if (status === 429) return "The model provider is rate limiting requests. Try again shortly.";
  if (err instanceof UnreadableMap) return "The model's answer couldn't be read.";
  return "The model call failed.";
}

/**
 * Competitive landscape stage: research the competitors, then map them on the
 * two axes that matter most in this market. Two calls rather than one, because
 * web-search answers come back as cited fragments that don't survive being
 * asked for JSON; the second call turns the prose notes into the grid.
 *
 * Runs alongside the main pipeline, so its searches go out as their own
 * landscape-search/landscape-source events, shown on the landscape card while
 * it works; as plain search/source events, interleaved with the main research
 * pass, they'd scramble the Web Search tab's query → sources grouping. Then it
 * reports the finished landscape. Throws when the map can't be built,
 * unreadable output included; the caller decides what a failure costs (see
 * `landscapeFailure`).
 */
export async function mapLandscape({
  model,
  deckText,
  playbook,
  companyName,
  form,
  emit,
  signal,
}: LandscapeArgs): Promise<void> {
  const provider = getProvider(deriveProvider(model));

  const research = await provider.researchWeb({
    model,
    system: buildLandscapeResearchSystemPrompt(playbook, deckText),
    user: buildLandscapeResearchUserPrompt(companyName, getResearchMaxSearches()),
    onSearch: (query) => emit({ type: "landscape-search", query }),
    onSource: ({ title, url }) => emit({ type: "landscape-source", title, url }),
    onUsage: (usage) => emit({ type: "usage", stage: "landscape-search", usage, costUsd: costOf(usage) }),
    signal,
  });
  signal?.throwIfAborted();

  const text = await provider.generateStream({
    model,
    system: buildLandscapeMapSystemPrompt(playbook, deckText),
    user: buildLandscapeMapUserPrompt(companyName, research.findings, research.sources),
    onUsage: (usage) => emit({ type: "usage", stage: "landscape", usage, costUsd: costOf(usage) }),
    signal,
  });

  signal?.throwIfAborted(); // the run may have ended while this was in flight
  const landscape = parseLandscape(text, research.sources, companyName);
  if (!landscape) throw new UnreadableMap();
  form.landscape = landscape;
  emit({ type: "landscape", landscape });
}

function text(v: unknown): string {
  return typeof v === "string" ? cleanDashes(v.trim()) : "";
}

/** A grid coordinate, rounded and clamped to 0–100; null when not a number. */
function coord(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : null;
}

/**
 * The company's homepage as an http(s) URL, or "" when it isn't one. The value
 * is model output that ends up in an `href`, so anything other than http(s) —
 * `javascript:`, `data:` and the like — is dropped rather than rendered. A bare
 * domain ("vrbo.com") gets https:// in front.
 */
export function cleanWebsite(v: unknown): string {
  const raw = typeof v === "string" ? v.trim() : "";
  if (!raw) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (!url.hostname.includes(".")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function parseAxis(v: unknown): LandscapeAxis | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const axis = { label: text(o.label), low: text(o.low), high: text(o.high), why: text(o.why) };
  return axis.label ? axis : null;
}

/**
 * Validate and repair the map pass's JSON. Needs both axes and at least two
 * companies placed; keeps one startup (falling back to a name match if the
 * model forgot to flag it), at most MAX_COMPETITORS competitors, and each of
 * the ranks 1–3 at most once.
 */
export function parseLandscape(
  raw: string,
  sources: Source[],
  companyName: string,
): CompetitiveLandscape | null {
  const obj = extractObject(raw);
  if (!obj) return null;
  const xAxis = parseAxis(obj.xAxis);
  const yAxis = parseAxis(obj.yAxis);
  if (!xAxis || !yAxis) return null;

  const placed: LandscapeCompany[] = [];
  for (const entry of Array.isArray(obj.companies) ? obj.companies : []) {
    const o = (entry ?? {}) as Record<string, unknown>;
    const name = text(o.name);
    const x = coord(o.x);
    const y = coord(o.y);
    if (!name || x === null || y === null) continue;
    const rank = o.rank === 1 || o.rank === 2 || o.rank === 3 ? o.rank : null;
    placed.push({
      name,
      website: cleanWebsite(o.website),
      x,
      y,
      subject: o.subject === true,
      description: text(o.description),
      whyCompetitor: text(o.whyCompetitor),
      contrast: text(o.contrast),
      rank,
    });
  }

  const wanted = companyName.trim().toLowerCase();
  const subject =
    placed.find((c) => c.subject) ?? (wanted ? placed.find((c) => c.name.toLowerCase() === wanted) : undefined);

  const ranks = new Set<number>();
  const competitors = placed
    .filter((c) => c !== subject)
    .slice(0, MAX_COMPETITORS)
    .map((c) => {
      const rank = c.rank && !ranks.has(c.rank) ? c.rank : null;
      if (rank) ranks.add(rank);
      return { ...c, subject: false, rank };
    });

  const companies = subject
    ? [{ ...subject, subject: true, rank: null, whyCompetitor: "", contrast: "" }, ...competitors]
    : competitors;
  if (companies.length < 2) return null;

  return { xAxis, yAxis, summary: text(obj.summary), companies, sources };
}
