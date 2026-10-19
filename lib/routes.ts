/**
 * The app's page paths, in one place, so moving a page is a one-line change.
 * The paths these replaced (`/due-diligence/*`, `/dashboard/due-diligence/*`,
 * `/model`, `/playbook`, `/account/*`) still work: `next.config.ts` redirects
 * them, for old bookmarks, emails and MCP links.
 */
export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  dashboard: "/dashboard",
  analyses: "/dashboard/analyses",
  model: "/dashboard/model",
  rubric: "/dashboard/rubric",
  account: "/dashboard/account",
  password: "/dashboard/account/password",
} as const;

const MODEL_PAGE = {
  id: "model",
  label: "Model",
  description: "The custom-trained model behind every verdict, and how it learned.",
  href: ROUTES.model,
} as const;

const RUBRIC_PAGE = {
  id: "rubric",
  label: "Rubric",
  description: "The pre-seed and seed criteria every deck is scored against.",
  href: ROUTES.rubric,
} as const;

/** What the product does, for the public nav's Products menu. */
export const PRODUCTS = [
  {
    id: "due-diligence",
    label: "Due diligence",
    description: "Upload a pitch deck, get a sourced report and a verdict.",
    href: ROUTES.analyses,
  },
  MODEL_PAGE,
  RUBRIC_PAGE,
] as const;

/** The dashboard sidebar's pages, top to bottom. */
export const DASHBOARD_PAGES = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Start an analysis, see your latest ones and how they add up.",
    href: ROUTES.dashboard,
  },
  {
    id: "analyses",
    label: "Analyses",
    description: "Every deck you've analysed, as cards or a list.",
    href: ROUTES.analyses,
  },
  MODEL_PAGE,
  RUBRIC_PAGE,
] as const;

export type ProductId = (typeof PRODUCTS)[number]["id"];
export type DashboardPageId = (typeof DASHBOARD_PAGES)[number]["id"];

/** Whether `pathname` is in the dashboard, which needs an account (see `proxy.ts`). */
export function isDashboardPath(pathname: string): boolean {
  return pathname === ROUTES.dashboard || pathname.startsWith(`${ROUTES.dashboard}/`);
}

/**
 * A deck's analysis: its overview, or one product's page of it. `id` is the
 * deck's SHA-256 (see `lib/analyses/hash.ts`); `product` is a slug from
 * `lib/products.ts`.
 */
export function analysisPath(id: string, product?: string): string {
  const base = `${ROUTES.analyses}/${encodeURIComponent(id)}`;
  return product ? `${base}/${product}` : base;
}

/** The query parameter that opens the Deck page at one slide: `…/deck?slide=4`. */
export const SLIDE_PARAM = "slide";

/** An analysis's Deck page, opened at `slide` (a 1-based PDF page). */
export function deckSlidePath(id: string, slide: number): string {
  return `${analysisPath(id, "deck")}?${new URLSearchParams({ [SLIDE_PARAM]: String(slide) })}`;
}

/** The slide a `?slide=` value asks for, or null when it isn't a page number. */
export function slideFromParam(value: string | string[] | null | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{1,4}$/.test(raw)) return null;
  const slide = Number(raw);
  return slide >= 1 ? slide : null;
}

/** The analysis `pathname` is inside (its overview or any of its pages), or null. */
export function analysisIdOf(pathname: string): string | null {
  const segment = pathname.startsWith(`${ROUTES.analyses}/`)
    ? pathname.slice(ROUTES.analyses.length + 1).split("/")[0]
    : "";
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The sign-in page, sending the user on to `next` once they're in. */
export function signInPath(next?: string): string {
  return next ? `${ROUTES.signIn}?${new URLSearchParams({ next })}` : ROUTES.signIn;
}

/**
 * Only ever redirect within this app — never to a caller-supplied host.
 * Resolved rather than pattern-matched: browsers read `/\evil.com` as
 * `//evil.com`, which a "starts with / but not //" check lets through. The
 * resolved path is checked too, since `/.//evil.com` tidies up into
 * `//evil.com`.
 */
export function safeNext(value: string | null | undefined, fallback = "/"): string {
  if (!value?.startsWith("/")) return fallback;
  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost" || url.pathname.startsWith("//")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
