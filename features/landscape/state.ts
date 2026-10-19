import { withSource } from "@/lib/core/search";
import type { ProgressEvent } from "@/lib/diligence/types";
import type { LandscapeState } from "./types";

export function initialLandscapeState(): LandscapeState {
  return { landscape: null, landscapeError: null, landscapeSearches: [] };
}

export function foldLandscape<S extends LandscapeState>(state: S, event: ProgressEvent): S {
  switch (event.type) {
    case "landscape-search":
      return {
        ...state,
        landscapeSearches: [...(state.landscapeSearches ?? []), { query: event.query, sources: [] }],
      };

    case "landscape-source":
      return {
        ...state,
        landscapeSearches: withSource(state.landscapeSearches ?? [], { title: event.title, url: event.url }),
      };

    case "landscape":
      return { ...state, landscape: event.landscape };

    case "landscape-failed":
      return { ...state, landscapeError: event.message };

    default:
      return state;
  }
}
