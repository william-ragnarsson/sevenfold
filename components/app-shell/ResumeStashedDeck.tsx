"use client";

import { useEffect, useRef } from "react";
import { useAnalysis } from "@/components/features/analyze/AnalysisProvider";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { takeStashedDeck } from "@/lib/analyses/pending-deck";
import { AIRBNB_SAMPLE } from "@/lib/samples/airbnb";

/**
 * Picks up the deck someone chose on the landing page before they had an
 * account (`AnalysisProvider` stashed it on the way to sign-in) and starts it,
 * once they're signed in and nothing else is running. It renders nothing.
 *
 * Mounted in the dashboard shell, where sign-in lands, so it runs whichever
 * page the round trip ends on.
 */
export default function ResumeStashedDeck() {
  const { isIdentified } = useAuth();
  const { status, setFile, start, startSample } = useAnalysis();
  // Once per mount: dev's Strict Mode runs effects twice, and the second
  // pass mustn't find the stash already taken and race the first.
  const triedRef = useRef(false);

  useEffect(() => {
    if (!isIdentified || status === "loading" || triedRef.current) return;
    triedRef.current = true;

    takeStashedDeck().then((deck) => {
      if (deck?.file) {
        setFile(deck.file);
        // The file goes in directly: `setFile` won't have landed by the time
        // `start` reads it.
        start({ file: deck.file });
      } else if (deck?.sampleId === AIRBNB_SAMPLE.id) {
        startSample(AIRBNB_SAMPLE);
      }
    });
  }, [isIdentified, status, setFile, start, startSample]);

  return null;
}
