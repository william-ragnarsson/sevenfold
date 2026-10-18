import type { SearchGroup, Source } from "@/lib/core/types";

/** One dimension of the competitive landscape grid, chosen for this market. */
export interface LandscapeAxis {
  /** e.g. "Price point". */
  label: string;
  /** What the low end (0) means, e.g. "Budget". */
  low: string;
  /** What the high end (100) means, e.g. "Premium". */
  high: string;
  /** Why this dimension is one of the two that matter most here. */
  why: string;
}

/** A company placed on the landscape grid — a competitor or the startup itself. */
export interface LandscapeCompany {
  name: string;
  /** Official homepage, http(s) only; "" when unknown (rendered without a link). */
  website: string;
  /** Position on each axis, 0 (low end) to 100 (high end). */
  x: number;
  y: number;
  /** True for the startup being analyzed (exactly one per landscape). */
  subject: boolean;
  /** One line on what the company does. */
  description: string;
  /** Why it competes with the startup; empty for the startup itself. */
  whyCompetitor: string;
  /** How the startup differs from it; empty for the startup itself. */
  contrast: string;
  /** 1–3 for the three most important competitors, otherwise null. */
  rank: 1 | 2 | 3 | null;
}

/** The startup and its competitors mapped on the two axes that matter most. */
export interface CompetitiveLandscape {
  xAxis: LandscapeAxis;
  yAxis: LandscapeAxis;
  /** 2–3 sentences: where the startup sits, where it's crowded, where the gap is. */
  summary: string;
  companies: LandscapeCompany[];
  /** Pages consulted while mapping the competitors. */
  sources: Source[];
}

export interface LandscapeForm {
  /**
   * The competitor map. Null until it's ready, or when it couldn't be built;
   * absent entirely on reports saved before it existed.
   */
  landscape?: CompetitiveLandscape | null;
}

export interface LandscapeState {
  /**
   * The competitor grid, once mapped. Optional because reports saved before
   * it existed don't carry it; read it as `state.landscape ?? null`.
   */
  landscape?: CompetitiveLandscape | null;
  /** Why the landscape is missing, when its stage failed. */
  landscapeError?: string | null;
  /** The landscape stage's own searches, shown on its card while it works. */
  landscapeSearches?: SearchGroup[];
}

export type LandscapeEvent =
  /**
   * A web search the landscape stage ran, and a source it surfaced. Kept apart
   * from `search`/`source`: the stage runs alongside the main research pass, and
   * interleaving the two would scramble each query's sources.
   */
  | { type: "landscape-search"; query: string }
  | { type: "landscape-source"; title: string; url: string }
  /** The competitive landscape grid, delivered whole once it's mapped. */
  | { type: "landscape"; landscape: CompetitiveLandscape }
  /** The landscape couldn't be built; the rest of the run carries on. */
  | { type: "landscape-failed"; message: string };
