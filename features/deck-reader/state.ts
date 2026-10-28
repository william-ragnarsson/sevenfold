import type { ProgressEvent } from "@/lib/diligence/types";
import type { DeckState, SlideText } from "./types";

/**
 * The deck slice of `AnalysisState`, and the caps that keep it small enough to
 * save. `foldDeck` is the only thing that writes it; `streamReducer` calls it
 * for every event, on the server (persistence) and in the browser alike.
 */

/** Longest stored text for one page. The model still reads the whole page. */
export const MAX_SLIDE_CHARS = 6_000;
/** Ceiling on all stored deck text in one report (slides + unassigned). */
export const MAX_DECK_STATE_CHARS = 150_000;
/** Pages beyond this are read but not recorded. */
export const MAX_SLIDES = 300;

/**
 * Clips page text to the per-page and whole-deck caps. One budget per run:
 * re-sending a page replaces its earlier share rather than adding to it.
 */
export function createDeckBudget() {
  const spent = new Map<number | "unassigned", number>();
  const total = () => [...spent.values()].reduce((a, b) => a + b, 0);

  const clip = (key: number | "unassigned", text: string, cap: number) => {
    spent.delete(key);
    const room = Math.max(0, Math.min(cap, MAX_DECK_STATE_CHARS - total()));
    const kept = text.length > room ? text.slice(0, room) : text;
    spent.set(key, kept.length);
    return { text: kept, truncated: kept.length < text.length };
  };

  return {
    slide(slide: SlideText): SlideText {
      const { text, truncated } = clip(slide.index, slide.text, MAX_SLIDE_CHARS);
      return truncated ? { index: slide.index, text, truncated: true } : { index: slide.index, text };
    },
    unassigned(text: string): string {
      return clip("unassigned", text, MAX_DECK_STATE_CHARS).text;
    },
  };
}

function emptyDeck(pageCount: number | null): DeckState {
  return { v: 1, pageCount, via: null, read: false, readThrough: 0, slides: [], evidence: {} };
}

/** Insert or replace one page, keeping the list sorted. An empty page is removed. */
function upsertSlide(slides: SlideText[], slide: SlideText): SlideText[] {
  const rest = slides.filter((s) => s.index !== slide.index);
  if (!slide.text) return rest.length === slides.length ? slides : rest;
  if (rest.length >= MAX_SLIDES) return slides;
  return [...rest, slide].sort((a, b) => a.index - b.index);
}

/**
 * Apply one event to the deck slice. Pure, and returns the same reference when
 * the event changes nothing, so the caller can skip a state copy.
 */
export function foldDeck(deck: DeckState | undefined, event: ProgressEvent): DeckState | undefined {
  if (event.type === "deck") return emptyDeck(event.pageCount);
  if (!deck) return deck;

  switch (event.type) {
    case "slide": {
      if (event.index < 1 || event.index > (deck.pageCount ?? MAX_SLIDES)) return deck;
      const slide: SlideText = event.truncated
        ? { index: event.index, text: event.text, truncated: true }
        : { index: event.index, text: event.text };
      const slides = upsertSlide(deck.slides, slide);
      const readThrough = Math.max(deck.readThrough, event.index);
      if (slides === deck.slides && readThrough === deck.readThrough) return deck;
      return { ...deck, slides, readThrough };
    }

    case "deck-read": {
      const lastSlide = deck.slides.at(-1)?.index ?? 0;
      const next: DeckState = {
        ...deck,
        read: true,
        via: event.via,
        readThrough: Math.max(deck.readThrough, deck.pageCount ?? 0, lastSlide),
      };
      if (event.unassigned) next.unassigned = event.unassigned;
      return next;
    }

    case "field": {
      // Only a deck value is backed by pages. A web one ranks with the deck's
      // and replaces it, so the deck's pages go with it; a lower source can't
      // replace a filled deck cell (`applyTextField`), so its pages stay.
      // Either way it cites none of its own.
      if (event.source !== "deck") {
        if (event.source !== "web" || !(event.key in deck.evidence)) return deck;
        const evidence = { ...deck.evidence };
        delete evidence[event.key];
        return { ...deck, evidence };
      }
      // The first citation stands. `complete` re-reads the deck beside the
      // research, and its second guess at the pages shouldn't replace
      // extract's; it can still cite a field extract left uncited.
      if (event.key in deck.evidence) return deck;
      const max = deck.pageCount ?? MAX_SLIDES;
      const cited = (event.slides ?? []).filter((n) => n >= 1 && n <= max);
      if (cited.length === 0) return deck;
      return { ...deck, evidence: { ...deck.evidence, [event.key]: cited } };
    }

    default:
      return deck;
  }
}
