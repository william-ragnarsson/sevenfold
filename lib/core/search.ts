import type { SearchGroup, Source } from "./types";

/**
 * Files a source under the latest search, or under "Background research" when
 * it came before any search.
 */
export function withSource(searches: SearchGroup[], source: Source): SearchGroup[] {
  if (searches.length === 0) return [{ query: "Background research", sources: [source] }];
  const last = searches[searches.length - 1];
  return [...searches.slice(0, -1), { ...last, sources: [...last.sources, source] }];
}
