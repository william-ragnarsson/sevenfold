import { withSource } from "@/lib/core/search";
import type { ProgressEvent } from "@/lib/diligence/types";
import type { ResearchState } from "./types";

export function initialResearchState(): ResearchState {
  return { searches: [], sourceCount: 0, notes: "" };
}

export function foldResearch<S extends ResearchState>(state: S, event: ProgressEvent): S {
  switch (event.type) {
    case "search":
      return { ...state, searches: [...state.searches, { query: event.query, sources: [] }] };

    case "source": {
      const searches = withSource(state.searches, { title: event.title, url: event.url });
      return { ...state, searches, sourceCount: state.sourceCount + 1 };
    }

    case "note":
      return { ...state, notes: state.notes + event.text };

    default:
      return state;
  }
}
