import { editedFounders } from "@/features/founders/form";
import type { Founder } from "@/features/founders/types";
import { DOC_SECTIONS, readField } from "./form-schema";
import type { DueDiligenceForm, FieldSource } from "./types";

/**
 * A person's edits to a saved memo. The browser applies one to its copy at
 * once, and `PATCH /api/analyses/<id>` applies the same one to the row's
 * fresh state, so both end up with the same form.
 */

/** Longest an edited text cell may be. */
export const MAX_EDITED_VALUE = 4000;

/** The sources a person can pick for a cell. "unknown" is only ever an empty one. */
export const PICKABLE_SOURCES = ["deck", "web", "inferred", "personal"] as const satisfies readonly FieldSource[];

/**
 * One change: a text cell's value, its source or both, or the whole founders
 * list (which is edited as one value, like the model writes it).
 */
export type MemoEdit =
  | { kind: "field"; key: string; value?: string; source?: (typeof PICKABLE_SOURCES)[number] }
  | { kind: "founders"; members: Founder[] };

/**
 * The text cells the memo shows, which are the ones a person may edit: every
 * text field outside the scorecard, `manualOnly` ones included.
 */
export const EDITABLE_KEYS: ReadonlySet<string> = new Set(
  DOC_SECTIONS.flatMap((s) => s.fields)
    .filter((f) => f.kind === "text")
    .map((f) => f.key),
);

/**
 * Apply an edit to the form (mutates). Returns false when there was nothing to
 * change: an unknown key, or the cell already says that.
 *
 * Typing a new value makes the cell "personal" unless the edit names a source;
 * clearing it makes it empty and "unknown". The text is kept as typed, apart
 * from the trim, and the founders list as `editedFounders` leaves it.
 */
export function applyMemoEdit(form: DueDiligenceForm, edit: MemoEdit): boolean {
  if (edit.kind === "founders") {
    const members = editedFounders(edit.members);
    // Rebuilt the same way on both sides, so key order (which jsonb doesn't
    // keep) can't make an unchanged list look changed.
    if (JSON.stringify(editedFounders(form.founders.members)) === JSON.stringify(members)) return false;
    form.founders.members = members;
    return true;
  }

  if (!EDITABLE_KEYS.has(edit.key)) return false;
  const current = readField(form, edit.key);
  if (!current) return false;

  const value = edit.value === undefined ? current.value : edit.value.trim().slice(0, MAX_EDITED_VALUE);
  const source: FieldSource = !value
    ? "unknown"
    : (edit.source ?? (value !== current.value ? "personal" : current.source));
  if (value === current.value && source === current.source) return false;

  const [section, name] = edit.key.split(".");
  (form as unknown as Record<string, Record<string, unknown>>)[section][name] = { value, source };
  return true;
}
