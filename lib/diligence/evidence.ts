import { checkCitations } from "@/features/deck-reader/citations";
import type { DeckState } from "@/features/deck-reader/types";
import { FIELD_DESCRIPTORS, readField } from "./form-schema";
import type { DueDiligenceForm } from "./types";

const KIND = new Map(FIELD_DESCRIPTORS.map((d) => [d.key, d.kind]));

/** A field's value as read off the deck, for `checkCitations`. */
function deckValue(form: DueDiligenceForm, key: string): string | null {
  switch (KIND.get(key)) {
    case "founders": {
      // A founder with no source is from a report older than founder sources,
      // where a cited list was read off the deck.
      const names = form.founders.members.filter((m) => (m.source ?? "deck") === "deck").map((m) => m.name);
      return names.length ? names.join(", ") : null;
    }
    case "number":
      // Funding is stored in whole dollars, which the deck rarely writes out.
      return form.scorecard.funding === null ? null : "";
    case "text": {
      const field = readField(form, key);
      return field?.value && field.source === "deck" ? field.value : null;
    }
    default:
      return null;
  }
}

const cache = new WeakMap<DeckState, WeakMap<DueDiligenceForm, Record<string, number[]>>>();

/**
 * Field key → the deck slides its value was read from, for every view that
 * shows them: the memo, the founders, the deck page, the memo's PDF and the
 * MCP markdown. Only deck values, and only the citations that hold up against
 * the slide's text (`checkCitations`), so a page never lists a field that
 * isn't on it. Worked out when shown, so saved reports get the same check.
 */
export function citedSlides({ deck, form }: { deck?: DeckState; form: DueDiligenceForm }): Record<string, number[]> {
  if (!deck) return {};
  let byForm = cache.get(deck);
  if (!byForm) cache.set(deck, (byForm = new WeakMap()));
  let cited = byForm.get(form);
  if (!cited) byForm.set(form, (cited = checkCitations(deck, (key) => deckValue(form, key))));
  return cited;
}
