import { applyTextField } from "@/lib/core/parse";
import { readField as readAnyField, type FieldDescriptor, type FormSection } from "@/lib/core/schema";
import { emptyFeedbackForm } from "@/features/feedback/form";
import { applyFoundersField, emptyFoundersForm, FOUNDERS_SECTION } from "@/features/founders/form";
import { emptyLandscapeForm } from "@/features/landscape/form";
import { COMPANY_SECTION, emptyMemoForm, MEMO_SECTIONS } from "@/features/memo/form";
import { emptyResearchForm } from "@/features/research/form";
import { applyScorecardField, emptyScorecardForm, SCORECARD_SECTION } from "@/features/scorecard/form";
import { emptyVerdictForm } from "@/features/verdict/form";
import type { DueDiligenceForm, Field, FieldSource } from "./types";

/**
 * The due-diligence form schema — the single source of truth for what the form
 * contains. It drives three things at once: the prompt (which keys the model
 * fills, in order), the streaming state, and the grid layout. Mirrors William's
 * Plug-and-Play DD template. Each product declares its own sections; this puts
 * them in report order.
 */

export type { FieldDescriptor, FieldKind, FormSection } from "@/lib/core/schema";
export { sectionSlug } from "@/lib/core/schema";
export { SCORECARD_METRIC_KEYS } from "@/features/scorecard/form";

export const DD_SECTIONS: FormSection[] = [COMPANY_SECTION, FOUNDERS_SECTION, ...MEMO_SECTIONS, SCORECARD_SECTION];

/** Flat, ordered list of every field descriptor. */
export const FIELD_DESCRIPTORS: FieldDescriptor[] = DD_SECTIONS.flatMap((s) => s.fields);

/** The document sub-sections shown in the DD form (the Scorecard is separate). */
export const DOC_SECTIONS: FormSection[] = DD_SECTIONS.filter((s) => s.title !== "Scorecard");

/** The `{ value, source }` cell behind a dotted text-field key, or null for any other key. */
export function readField(form: DueDiligenceForm, key: string): Field | null {
  return readAnyField(form, key);
}

/**
 * Labels of the fields still empty after the deck pass — the research stage
 * targets these specifically. Skips manual-only fields and the scorecard
 * (scored later), and special-cases the founders list.
 */
export function computeGaps(form: DueDiligenceForm): string[] {
  const gaps: string[] = [];
  for (const f of FIELD_DESCRIPTORS) {
    if (f.manualOnly || f.kind === "rating" || f.kind === "number") continue;
    if (f.kind === "founders") {
      if (form.founders.members.length === 0) gaps.push("Founders — names, roles, and backgrounds");
      continue;
    }
    const [section, field] = f.key.split(".");
    const node = (form as unknown as Record<string, Record<string, unknown>>)[section];
    const target = node?.[field] as { value?: string } | undefined;
    if (!target?.value) gaps.push(f.label);
  }
  return gaps;
}

/** A blank form with every field unfilled. */
export function emptyForm(): DueDiligenceForm {
  const { company, ...memo } = emptyMemoForm();
  return {
    company,
    ...emptyFoundersForm(),
    ...memo,
    ...emptyScorecardForm(),
    ...emptyVerdictForm(),
    ...emptyFeedbackForm(),
    ...emptyLandscapeForm(),
    ...emptyResearchForm(),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Products whose keys aren't plain text cells. Each returns null for a key it
 * doesn't own, so the next one gets a look.
 */
const FIELD_HANDLERS: ((form: DueDiligenceForm, key: string, value: unknown, source: FieldSource) => boolean | null)[] = [
  applyFoundersField,
  applyScorecardField,
];

/**
 * Apply a parsed field onto the form (mutates). Returns true if the key was
 * recognized and written; false for an unrecognized key or a write skipped
 * because it would downgrade an already-filled field to a lower-confidence
 * source. Either way the caller should not emit a `field` event for a false
 * return.
 */
export function applyField(
  form: DueDiligenceForm,
  key: string,
  value: unknown,
  source: FieldSource,
): boolean {
  for (const handle of FIELD_HANDLERS) {
    const handled = handle(form, key, value, source);
    if (handled !== null) return handled;
  }
  // Dotted "section.field" → a Field { value, source }.
  return applyTextField(form, key, value, source);
}
