import { cleanDashes, extractObject } from "@/lib/core/parse";
import type { Source } from "@/lib/core/types";
import type { CompetitiveLandscape, LandscapeAxis, LandscapeCompany } from "./types";

/** Competitors kept on the grid, besides the startup; more turns it into noise. */
const MAX_COMPETITORS = 10;

/** The model answered, but not with a map we could read. */
export class UnreadableMap extends Error {}

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
