import type { Metadata } from "next";
import { ROUTES, safeNext } from "@/lib/routes";
import SignInScreen from "./SignInScreen";

export const metadata: Metadata = {
  title: "Log in · SevenFold",
  robots: { index: false, follow: false },
};

/**
 * Logging in and signing up, as a page of its own: the nav's "Log in" and
 * "Sign up" land here, `proxy.ts` sends signed-out visits to the dashboard
 * here, and so do the auth routes when an email link can't sign you in.
 * `next` is where to go afterwards, the dashboard unless it says otherwise.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  const target = safeNext(typeof next === "string" ? next : null, ROUTES.dashboard);
  // Coming back here once signed in would leave you on this page for good.
  return <SignInScreen next={target.startsWith(ROUTES.signIn) ? ROUTES.dashboard : target} />;
}
