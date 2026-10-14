import { NextResponse, type NextRequest } from "next/server";
import { ROUTES } from "@/lib/routes";

/** Which way an email link was headed: confirming a new account, or resetting a password. */
export type EmailFlow = "signup" | "recovery";

/** Redirect to a path on this app, handing the page a result in its query string. */
export function redirectTo(request: NextRequest, path: string, params: Record<string, string> = {}) {
  // Behind Vercel's proxy the request origin is the internal host; the
  // forwarded header is the one the browser actually used.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const base =
    process.env.NODE_ENV === "development" || !forwardedHost
      ? new URL(request.url).origin
      : `${proto}://${forwardedHost}`;

  const url = new URL(path, base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

/**
 * An email link Supabase refused: expired, already used, or a later one sent
 * since. Back to the form that sends a fresh one.
 */
export function deadLink(request: NextRequest, flow: EmailFlow) {
  return flow === "recovery"
    ? redirectTo(request, ROUTES.password, {
        auth_email: "forgot",
        auth_error: "That reset link has expired or was already used. Request a new one.",
      })
    : redirectTo(request, ROUTES.signIn, {
        auth_email: "login",
        auth_error:
          "That confirmation link has expired or was already used. Log in if you've confirmed your email already, or sign up again for a new link.",
      });
}

/**
 * Supabase accepted the link but its sign-in code can't be redeemed here —
 * usually because the link was opened in a different browser from the one
 * that asked for it. A confirmation still counts, so that only costs a log-in;
 * a reset needs a new link.
 */
export function codeUnusable(request: NextRequest, flow: EmailFlow) {
  return flow === "recovery"
    ? redirectTo(request, ROUTES.password, {
        auth_email: "forgot",
        auth_error:
          "That reset link has expired or was opened in a different browser. Request a new one.",
      })
    : redirectTo(request, ROUTES.signIn, {
        auth_email: "login",
        auth_notice: "Your email is confirmed. Log in to continue.",
      });
}
