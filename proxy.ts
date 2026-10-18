import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "@/lib/config";
import { isDashboardPath, signInPath } from "@/lib/routes";

/**
 * Refreshes the Supabase session on every request, and keeps the dashboard
 * (`/dashboard/*`) to signed-in accounts.
 *
 * Access tokens are short-lived. Server code (`/api/analyze`, `/auth/callback`)
 * reads the session from cookies, so something has to rotate the refresh token
 * and write the new cookies back — that's this. Without it you get the classic
 * symptoms: random sign-outs and analyses that fail to save after an hour idle.
 *
 * This is Next 16's `proxy.ts`, the rename of `middleware.ts`. Two things
 * changed with it: the exported function is named `proxy`, and the `edge`
 * runtime is no longer supported here (it always runs on Node and can't be
 * configured). See `docs/01-app/02-guides/upgrading/version-16.md`.
 *
 * The gate is a redirect to `/sign-in?next=…`, for anyone without a session
 * and for anonymous sessions too: those come from before the dashboard needed
 * an account, and signing in claims their reports. It's the front door, not
 * the lock — data is still guarded next to itself (RLS in Postgres, an
 * explicit user lookup in the API routes). With no Supabase project
 * configured there are no accounts, so nothing is gated.
 */
export async function proxy(request: NextRequest) {
  // `getAll` reads from the *request*; `setAll` has to write to both, so that
  // the refreshed token is visible to the rest of this request as well as to
  // the browser. Recreating the response after setting request cookies is the
  // documented Supabase pattern — don't "simplify" it.
  let response = NextResponse.next({ request });
  // The no-cache headers Supabase sends with refreshed cookies, kept apart
  // from `response`'s own so a redirect can carry them too.
  let authHeaders: Record<string, string> = {};

  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Responses carrying Set-Cookie for auth must never be cached by a
          // CDN, or one visitor's session is served to the next.
          authHeaders = headers;
          for (const [key, headerValue] of Object.entries(headers)) {
            response.headers.set(key, headerValue);
          }
        },
      },
    },
  );

  // Must be awaited before the response is returned, or a refresh that lands
  // late has nowhere to write its cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  if (isDashboardPath(pathname) && (!user || user.is_anonymous)) {
    const redirect = NextResponse.redirect(new URL(signInPath(pathname + search), request.url));
    // A refresh that just happened still has to reach the browser.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    for (const [key, value] of Object.entries(authHeaders)) redirect.headers.set(key, value);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets — those never carry a session and
     * waking a Node function for each one is pure waste — and the MCP server
     * with its OAuth metadata, which authenticate with bearer tokens, never
     * cookies.
     */
    "/((?!_next/static|_next/image|favicon.ico|mcp(?:/|$)|\\.well-known/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|woff|woff2)$).*)",
  ],
};
