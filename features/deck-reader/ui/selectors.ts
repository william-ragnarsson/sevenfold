import type { FieldSource } from "@/lib/core/types";
import { FIELD_DESCRIPTORS, readField } from "@/lib/diligence/form-schema";
import type { DueDiligenceForm } from "@/lib/diligence/types";
import type { DeckState, DeckVia } from "../types";

/**
 * Read-only views over a `DeckState` and the form, for anything that wants to
 * show or reuse the per-slide picture. The UI is one consumer; nothing here
 * knows about it.
 */

/** One form field the model said it took from a slide. */
export interface SlideFinding {
  key: string;
  label: string;
  value: string;
  source: FieldSource;
}

export type SlideStatus =
  /** Not reached yet. */
  | "pending"
  /** The reader is on this page now. */
  | "reading"
  /** Read, and it had text. */
  | "read"
  /** Read, and there was nothing on it to transcribe. */
  | "blank"
  /** The deck was read as one block with no page markers, so pages can't be told apart. */
  | "unmapped";

export interface SlideView {
  index: number;
  status: SlideStatus;
  /** What was read off the page; null until it is read or when it had none. */
  text: string | null;
  truncated: boolean;
  findings: SlideFinding[];
}

/** How many tiles to draw: the PDF's page count, else the highest page seen. */
export function deckTotal(deck: DeckState): number {
  return deck.pageCount ?? Math.max(deck.readThrough, deck.slides.at(-1)?.index ?? 0);
}

/** True when the deck was read but its text couldn't be split into pages. */
export function isUnmapped(deck: DeckState): boolean {
  return deck.read && deck.slides.length === 0 && !!deck.unassigned;
}

/**
 * What a cited field holds now, as read off the deck. A value from the web,
 * the model's own inference or a person's edit isn't shown on the slide it
 * replaced; neither are the founders who didn't come from the deck.
 */
function findingValue(form: DueDiligenceForm, key: string, kind: string): { value: string; source: FieldSource } | null {
  if (kind === "founders") {
    // A founder with no source is from a report older than founder sources,
    // where a cited list was read off the deck.
    const names = form.founders.members
      .filter((m) => (m.source ?? "deck") === "deck")
      .map((m) => m.name)
      .filter(Boolean);
    return names.length ? { value: names.join(", "), source: "deck" } : null;
  }
  if (key === "scorecard.funding") {
    const n = form.scorecard.funding;
    return n === null ? null : { value: `$${n.toLocaleString("en-US")}`, source: "deck" };
  }
  const field = readField(form, key);
  return field?.value && field.source === "deck" ? { value: field.value, source: field.source } : null;
}

/**
 * Page number → the fields cited from it, in form order. `evidence` is the
 * deck's citations once checked (`citedSlides`, passed in by the report).
 * Fields with no deck value (yet, or any more) are left out, so a tile never
 * shows a chip for nothing.
 */
export function findingsBySlide(evidence: Record<string, number[]>, form: DueDiligenceForm): Map<number, SlideFinding[]> {
  const bySlide = new Map<number, SlideFinding[]>();
  for (const d of FIELD_DESCRIPTORS) {
    const pages = evidence[d.key];
    if (!pages?.length) continue;
    const found = findingValue(form, d.key, d.kind);
    if (!found) continue;
    for (const page of pages) {
      const list = bySlide.get(page) ?? [];
      list.push({ key: d.key, label: d.label, ...found });
      bySlide.set(page, list);
    }
  }
  return bySlide;
}

/** A field and the first slide it was cited from. */
export interface CitationStop {
  key: string;
  slide: number;
}

/**
 * Every field a slide lists, once, at the first slide that lists it, in the
 * order the fields were first cited (`foldDeck` adds new keys to `evidence`
 * at the end). Lets a view go to each place the model found something, as it
 * found it.
 */
export function citationTour(evidence: Record<string, number[]>, findings: Map<number, SlideFinding[]>): CitationStop[] {
  return Object.entries(evidence).flatMap(([key, pages]) => {
    const slide = pages.find((page) => findings.get(page)?.some((f) => f.key === key));
    return slide === undefined ? [] : [{ key, slide }];
  });
}

export interface SlideViewOptions {
  /**
   * Pages up to and including this one are shown as finished. The UI paces it
   * behind `deck.readThrough` so a burst of pages still reads as a sweep.
   */
  cursor: number;
  /** Whether a reader is still moving, i.e. the page after `cursor` is "reading". */
  scanning: boolean;
}

/** One view per page, 1…total, with everything a tile needs. */
export function buildSlideViews(
  deck: DeckState,
  findings: Map<number, SlideFinding[]>,
  { cursor, scanning }: SlideViewOptions,
): SlideView[] {
  const total = deckTotal(deck);
  const text = new Map(deck.slides.map((s) => [s.index, s]));
  const unmapped = isUnmapped(deck);

  return Array.from({ length: total }, (_, i) => {
    const index = i + 1;
    const slide = text.get(index);
    const done = index <= cursor;
    let status: SlideStatus = "pending";
    if (done) status = unmapped ? "unmapped" : slide ? "read" : "blank";
    else if (scanning && index === cursor + 1) status = "reading";

    return {
      index,
      status,
      text: done && slide ? slide.text : null,
      truncated: !!slide?.truncated,
      findings: done ? (findings.get(index) ?? []) : [],
    };
  });
}

const VIA_LABEL: Record<DeckVia, string> = {
  "text-layer": "the PDF's text layer",
  "vision-ocr": "vision OCR",
  provided: "a supplied transcription",
};

export function deckViaLabel(via: DeckVia | null): string | null {
  return via ? VIA_LABEL[via] : null;
}

/** One line describing where the read stands, for a header or a status bar. */
export function deckProgressLabel(deck: DeckState | undefined, views: SlideView[], scanning: boolean): string {
  if (!deck) return "Opening the deck…";
  const total = views.length;
  const reading = views.find((v) => v.status === "reading");
  if (scanning) {
    return reading && total ? `Reading slide ${reading.index} of ${total}` : "Reading the deck…";
  }
  if (!deck.read) return total ? `Stopped after slide ${deck.readThrough} of ${total}` : "The deck wasn't read";
  if (isUnmapped(deck)) return "Read as one block, so slides couldn't be told apart";

  const withText = views.filter((v) => v.status === "read").length;
  const cited = new Set(views.flatMap((v) => v.findings.map((f) => f.key))).size;
  const fields = cited === 1 ? "1 field cited" : `${cited} fields cited`;
  return `${withText} of ${total} slides had text · ${fields}`;
}
