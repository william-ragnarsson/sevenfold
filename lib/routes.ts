/**
 * The app's page paths, in one place, so moving a page is a one-line change.
 * The paths these replaced (`/due-diligence/*`, `/account/*`) still work:
 * `next.config.ts` redirects them, for old bookmarks, emails and MCP links.
 */
export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  /** The public write-up of the criteria. `context` is the same text inside the app. */
  playbook: "/playbook",
  decks: "/app/decks",
  context: "/app/context",
  settings: "/app/settings",
  password: "/app/settings/password",
} as const;

/** A deck's report. `id` is the deck's SHA-256 (see `lib/analyses/hash.ts`). */
export function analysisPath(id: string): string {
  return `${ROUTES.decks}/${id}`;
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
