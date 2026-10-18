/**
 * The app's page paths, in one place, so moving a page is a one-line change.
 * The paths these replaced (`/due-diligence/*`, `/model`, `/playbook`,
 * `/account/*`) still work: `next.config.ts` redirects them, for old
 * bookmarks, emails and MCP links.
 */
export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  dashboard: "/dashboard",
  dueDiligence: "/dashboard/due-diligence",
  model: "/dashboard/model",
  rubric: "/dashboard/rubric",
  account: "/dashboard/account",
  password: "/dashboard/account/password",
} as const;

/**
 * What the product does, one entry per dashboard page. The public nav's
 * Products menu and the dashboard sidebar both read this, so they can't drift.
 */
export const PRODUCTS = [
  {
    id: "due-diligence",
    label: "Due diligence",
    description: "Upload a pitch deck, get a sourced report and a verdict.",
    href: ROUTES.dueDiligence,
  },
  {
    id: "model",
    label: "Model",
    description: "The custom-trained model behind every verdict, and how it learned.",
    href: ROUTES.model,
  },
  {
    id: "rubric",
    label: "Rubric",
    description: "The pre-seed and seed criteria every deck is scored against.",
    href: ROUTES.rubric,
  },
] as const;

export type ProductId = (typeof PRODUCTS)[number]["id"];

/** Whether `pathname` is in the dashboard, which needs an account (see `proxy.ts`). */
export function isDashboardPath(pathname: string): boolean {
  return pathname === ROUTES.dashboard || pathname.startsWith(`${ROUTES.dashboard}/`);
}

/** A deck's report. `id` is the deck's SHA-256 (see `lib/analyses/hash.ts`). */
export function analysisPath(id: string): string {
  return `${ROUTES.dueDiligence}/${id}`;
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
