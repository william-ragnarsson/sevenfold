import type { SearchGroup, Source } from "@/lib/core/types";

export interface ResearchForm {
  /** Sources the web research consulted. */
  sources: Source[];
}

export interface ResearchState {
  searches: SearchGroup[];
  sourceCount: number;
  /** The model's live research notes, as they streamed in. */
  notes: string;
}

export type ResearchEvent =
  /** A web search the model ran with this query. */
  | { type: "search"; query: string }
  /** A source the model consulted while researching. */
  | { type: "source"; title: string; url: string }
  /** An incremental chunk of the model's live research notes (observational). */
  | { type: "note"; text: string };
