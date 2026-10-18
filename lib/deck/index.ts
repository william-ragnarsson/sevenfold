/**
 * Per-slide deck data: types, the `[Slide N]` marker format, the parser that
 * splits deck text into pages, the `AnalysisState.deck` fold, and selectors.
 * DOM-free and shared by server and client.
 */
export * from "./types";
export * from "./markers";
export * from "./parser";
export * from "./state";
export * from "./selectors";
