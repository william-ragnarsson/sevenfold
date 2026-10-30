import type { Field } from "./types";

/**
 * Form-schema primitives. Each product declares the fields it contributes as
 * `FormSection`s; `lib/diligence/form-schema.ts` puts them in report order.
 * The registry drives the prompts (which keys the model fills, in order), the
 * streaming state, and the layout.
 */

export type FieldKind = "text" | "founders" | "rating" | "number";

export interface FieldDescriptor {
  /** Dotted path into DueDiligenceForm, e.g. "company.founded". */
  key: string;
  /** Grid label, e.g. "Founded". */
  label: string;
  kind: FieldKind;
  /** Guidance to the model on what belongs here. */
  hint: string;
  /** True for fields a deck/web can't supply (the VC's own meeting notes). */
  manualOnly?: boolean;
}

export interface FormSection {
  title: string;
  fields: FieldDescriptor[];
}

/**
 * Stable anchor id for a document sub-section, so a link can open the memo at
 * it (`memo#doc-company-overview`). e.g. "Company Overview" →
 * "doc-company-overview".
 */
export function sectionSlug(title: string): string {
  return "doc-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** The `{ value, source }` cell behind a dotted text-field key, or null for any other key. */
export function readField(form: object, key: string): Field | null {
  const [section, field] = key.split(".");
  const node = (form as Record<string, Record<string, unknown>>)[section];
  const target = node?.[field];
  if (target && typeof target === "object" && "value" in target) return target as Field;
  return null;
}

export const emptyField = (): Field => ({ value: "", source: "unknown" });
