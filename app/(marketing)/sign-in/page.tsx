import type { Metadata } from "next";
import { ROUTES, safeNext } from "@/lib/routes";
import SignInScreen from "./SignInScreen";

export const metadata: Metadata = {
  title: "Log in · SevenFold",
  robots: { index: false, follow: false },
};

/**
 * Logging in or signing up as a page of its own, for links that need one: the
 * sidebar's "Log in", and the auth routes when a link can't sign you in.
 * `next` is where to go afterwards, the dashboard unless it says otherwise.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  const target = safeNext(typeof next === "string" ? next : null, ROUTES.decks);
  // Coming back here once signed in would leave you on this page for good.
  return <SignInScreen next={target.startsWith(ROUTES.signIn) ? ROUTES.decks : target} />;
}
