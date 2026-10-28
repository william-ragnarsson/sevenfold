import { MAX_DECK_STATE_CHARS, MAX_SLIDES } from "./state";
import type { DeckState } from "./types";

/**
 * A check on the model's slide citations against what was read off each
 * slide. The model sometimes cites a page its value isn't on, and that page
 * then lists a field it has nothing to do with. A citation stands when the
 * value shares a distinctive word or number with the page's text, and falls
 * when the page had no text at all, since the model only ever read the text.
 *
 * Loose on purpose: one shared word is enough, and anything it can't judge
 * stands. That covers a value with no distinctive words, one whose words are
 * nowhere in the deck (a summary in other words, or another language), a
 * page whose stored text was clipped, a deck read as one block, and a deck
 * where most citations miss, which is a memo written in a different language
 * from the slides.
 */

/** Words too common in decks and memos to tie a value to one slide. */
const COMMON = new Set(
  (
    "about above after again also among another based been before being below between both build built " +
    "came come could does doing done down during each even every from have having here into just like made " +
    "make makes making many more most much must need needs only other over same should since some such than " +
    "that their them then there these they this those through under until very want were what when where " +
    "which while will with within without would year years your " +
    "business businesses company companies customer customers market markets people platform platforms " +
    "problem problems product products service services solution solutions startup startups team teams " +
    "user users using"
  ).split(" "),
);

/**
 * A text's distinctive terms: numbers of two digits or more without their
 * separators, and words of four letters or more, cut to five so "travel" and
 * "travellers" meet. Accents are dropped, so "café" and "cafe" meet too.
 */
function termsOf(text: string): Set<string> {
  const terms = new Set<string>();
  const plain = text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  for (const [token] of plain.matchAll(/\p{N}+(?:[.,]\p{N}+)*|\p{L}+/gu)) {
    if (/^\p{N}/u.test(token)) {
      const digits = token.replace(/[.,]/g, "");
      if (digits.length >= 2) terms.add(digits);
    } else if (token.length >= 4 && !COMMON.has(token)) {
      const word = token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token;
      terms.add(word.slice(0, 5));
    }
  }
  return terms;
}

function shares(a: Set<string>, b: Set<string>): boolean {
  for (const term of a) if (b.has(term)) return true;
  return false;
}

interface DeckTerms {
  bySlide: Map<number, { terms: Set<string>; truncated: boolean }>;
  all: Set<string>;
  /** Some pages' text was cut by the caps, so a page with none may have had some. */
  clipped: boolean;
}

const termsCache = new WeakMap<DeckState["slides"], DeckTerms>();

function deckTerms(deck: DeckState): DeckTerms {
  const cached = termsCache.get(deck.slides);
  if (cached) return cached;
  const bySlide = new Map<number, { terms: Set<string>; truncated: boolean }>();
  const all = new Set<string>();
  let chars = deck.unassigned?.length ?? 0;
  for (const slide of deck.slides) {
    const terms = termsOf(slide.text);
    for (const term of terms) all.add(term);
    bySlide.set(slide.index, { terms, truncated: !!slide.truncated });
    chars += slide.text.length;
  }
  const result = { bySlide, all, clipped: chars >= MAX_DECK_STATE_CHARS || deck.slides.length >= MAX_SLIDES };
  termsCache.set(deck.slides, result);
  return result;
}

/**
 * The deck's citations that stand, field key → pages. `valueOf` gives a
 * field's deck value: null when it has none (the field is dropped), and an
 * empty string when there's nothing to compare (its pages stand). Returns
 * `deck.evidence` itself when every citation stands.
 */
export function checkCitations(deck: DeckState, valueOf: (key: string) => string | null): Record<string, number[]> {
  const { bySlide, all, clipped } = deckTerms(deck);
  // Read as one block, so no page has text of its own to compare with.
  const unmapped = deck.slides.length === 0;

  // Each citation: it stands, it falls, or it missed its page's words. A miss
  // is "soft" when the value's words are nowhere in the deck at all.
  type Verdict = "stands" | "falls" | "miss" | "soft";
  const verdicts: { key: string; pages: { page: number; verdict: Verdict }[] }[] = [];
  let compared = 0;
  let missed = 0;

  for (const [key, pages] of Object.entries(deck.evidence)) {
    const value = valueOf(key);
    if (value === null) {
      verdicts.push({ key, pages: pages.map((page) => ({ page, verdict: "falls" })) });
      continue;
    }
    const terms = termsOf(value);
    const inDeck = shares(terms, all);
    verdicts.push({
      key,
      pages: pages.map((page) => {
        if (unmapped) return { page, verdict: "stands" };
        const slide = bySlide.get(page);
        if (!slide) return { page, verdict: clipped ? "stands" : "falls" };
        if (terms.size === 0 || slide.truncated) return { page, verdict: "stands" };
        compared++;
        if (shares(terms, slide.terms)) return { page, verdict: "stands" };
        missed++;
        return { page, verdict: inDeck ? "miss" : "soft" };
      }),
    });
  }

  // Most citations missing their page's words is a memo in another language
  // from the deck, not a model citing at random: every miss stands.
  const missesStand = missed * 2 > compared;
  const standing = (verdict: Verdict) =>
    verdict === "stands" || verdict === "soft" || (verdict === "miss" && missesStand);

  let changed = false;
  const kept: Record<string, number[]> = {};
  for (const { key, pages } of verdicts) {
    const stands = pages.filter((p) => standing(p.verdict)).map((p) => p.page);
    if (stands.length < pages.length) changed = true;
    if (stands.length > 0) kept[key] = stands;
  }
  return changed ? kept : deck.evidence;
}
