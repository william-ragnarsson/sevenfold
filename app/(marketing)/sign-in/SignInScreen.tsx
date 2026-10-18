"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/features/auth/AuthProvider";
import SignInCard from "@/components/features/auth/SignInCard";
import { peekStashedDeck } from "@/lib/analyses/pending-deck";
import { AIRBNB_SAMPLE } from "@/lib/samples/airbnb";
import { ROUTES } from "@/lib/routes";

export default function SignInScreen({ next }: { next: string }) {
  const { isIdentified, loading, configured } = useAuth();
  const router = useRouter();
  // The deck picked on the landing page before signing up, if that's how
  // they got here. Read from IndexedDB, so it only appears after mount.
  const [deckName, setDeckName] = useState<string | null>(null);

  // Signed in, whether on this page or by a provider or email link that came
  // back to it (they return to the page they started from): carry on.
  useEffect(() => {
    if (isIdentified) router.replace(next);
  }, [isIdentified, next, router]);

  useEffect(() => {
    let cancelled = false;
    peekStashedDeck().then((deck) => {
      if (cancelled || !deck) return;
      setDeckName(deck.file?.name ?? (deck.sampleId === AIRBNB_SAMPLE.id ? AIRBNB_SAMPLE.label : null));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!configured) {
    return (
      <div className="mx-auto max-w-sm px-4 pt-10 pb-20 text-center">
        <p className="text-muted">Accounts aren&apos;t set up on this deployment.</p>
        <Link
          href={ROUTES.dashboard}
          className="mt-4 inline-block text-sm font-medium text-accent hover:text-ink"
        >
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
      {deckName && (
        <p className="mb-4 text-center text-sm text-muted">
          Sign up to analyse <span className="font-medium text-ink">{deckName}</span>. It starts
          as soon as you&apos;re in.
        </p>
      )}
      <SignInCard />
    </div>
  );
}
