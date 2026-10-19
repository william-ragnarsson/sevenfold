/**
 * The kernel's vocabulary: the types every product shares. Nothing in
 * `lib/core` knows which products exist; `lib/diligence` composes them and
 * `features/<product>` builds on this.
 */

export interface Source {
  title: string;
  url: string;
}

/**
 * Where a filled-in field value came from. "personal" is a person's own edit
 * in the report; models never send it.
 */
export type FieldSource = "deck" | "web" | "inferred" | "unknown" | "personal";

/**
 * One text cell of the report. Every scalar field carries its value and where
 * it came from, so the UI can badge deck-sourced vs web-sourced cells and fill
 * them in live.
 */
export interface Field {
  value: string;
  source: FieldSource;
}

/** One search query and the sources it surfaced. */
export interface SearchGroup {
  query: string;
  sources: Source[];
}

/** Input every stage gets: the deck as text, plus the investor's playbook. */
export interface DiligenceInput {
  deckText: string;
  playbook: string;
}

/** What the research stage hands to the stages after it. */
export interface ResearchResult {
  /** Prose research notes. */
  findings: string;
  /** Sources consulted (authoritative URL list). */
  sources: Source[];
}

export type DiligencePhase =
  | "extracting"
  | "researching"
  | "completing"
  | "verdict"
  | "done";

/** Thrown when a deck has too little extractable text (e.g. image-only PDF). */
export class EmptyDeckError extends Error {
  constructor(message = "Could not read text from this PDF. It may be image-only or scanned.") {
    super(message);
    this.name = "EmptyDeckError";
  }
}
