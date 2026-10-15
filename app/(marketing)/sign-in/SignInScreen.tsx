"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/features/auth/AuthProvider";
import SignInCard from "@/components/features/auth/SignInCard";
import { ROUTES } from "@/lib/routes";

export default function SignInScreen({ next }: { next: string }) {
  const { isIdentified, loading, configured } = useAuth();
  const router = useRouter();

  // Signed in, whether on this page or by a provider or email link that came
  // back to it (they return to the page they started from): carry on.
  useEffect(() => {
    if (isIdentified) router.replace(next);
  }, [isIdentified, next, router]);

  if (!configured) {
    return (
      <div className="mx-auto max-w-sm px-4 pt-10 pb-20 text-center">
        <p className="text-muted">Accounts aren&apos;t set up on this deployment.</p>
        <Link href={ROUTES.decks} className="mt-4 inline-block text-sm font-medium text-accent hover:text-ink">
          Go to the dashboard →
        </Link>
      </div>
    );
  }

  if (loading || isIdentified) {
    return <div className="mx-auto max-w-sm px-4 pt-10 text-center text-muted">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-sm px-4 pt-10 pb-20">
      <SignInCard />
    </div>
  );
}
