import { emptyField, type FormSection } from "@/lib/core/schema";
import { isFieldSource, str } from "@/lib/core/parse";
import type { FieldSource } from "@/lib/core/types";
import type { Founder, FoundersForm } from "./types";

export const FOUNDERS_SECTION: FormSection = {
  title: "Founders & Cap Table",
  fields: [
    { key: "founders", label: "Founders", kind: "founders", hint: "Array of founders, each { role, name, commitment, background[] }. role e.g. CEO/COO/CFO; commitment e.g. 'Full-time | Co-founder & CEO'; background = bullet points of prior companies/roles/education." },
    { key: "founders.howTheyMet", label: "How they met", kind: "text", hint: "How the founders know each other and the trust signal it gives." },
    { key: "founders.capTable", label: "Cap Table", kind: "text", hint: "Cap table / round details: investors, amounts, dilution, structure." },
  ],
};

export function emptyFoundersForm(): FoundersForm {
  return { founders: { members: [], howTheyMet: emptyField(), capTable: emptyField() } };
}

/** The model's founders list, cleaned up; rows with neither a name nor a role are dropped. */
export function normalizeFounders(value: unknown): Founder[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((f) => {
      const o = (f ?? {}) as Record<string, unknown>;
      return {
        role: str(o.role),
        name: str(o.name),
        commitment: str(o.commitment),
        background: Array.isArray(o.background) ? o.background.map(str).filter(Boolean) : [],
      };
    })
    .filter((f) => f.name || f.role);
}

/** Most founders an edited list keeps. */
export const MAX_FOUNDERS = 12;
/** Most background bullets an edited founder keeps. */
export const MAX_FOUNDER_BACKGROUND = 10;
/** Longest an edited founder's name, role, commitment or bullet may be. */
const MAX_FOUNDER_TEXT = 500;

/**
 * A person's edit of the founders list, cleaned up and bounded. Unlike
 * `normalizeFounders`, the text is kept as typed (no dash cleanup) and each
 * founder keeps its own source. One without a valid source keeps none, as a
 * founder saved before founders carried a source has none.
 */
export function editedFounders(value: unknown): Founder[] {
  if (!Array.isArray(value)) return [];
  const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_FOUNDER_TEXT) : "");
  return value
    .slice(0, MAX_FOUNDERS)
    .map((f): Founder => {
      const o = (f ?? {}) as Record<string, unknown>;
      const founder: Founder = {
        role: text(o.role),
        name: text(o.name),
        commitment: text(o.commitment),
        background: Array.isArray(o.background) ? o.background.map(text).filter(Boolean).slice(0, MAX_FOUNDER_BACKGROUND) : [],
      };
      if (isFieldSource(o.source)) founder.source = o.source;
      return founder;
    })
    .filter((f) => f.name || f.role);
}

/**
 * Where a founder came from. Founders saved before they carried a source were
 * read off the deck when it cited slides for them (the Deck page assumes the
 * same); otherwise there's no telling.
 */
export function founderSource(founder: Founder, slides: number[] | undefined): FieldSource | undefined {
  return founder.source ?? (slides?.length ? "deck" : undefined);
}

/**
 * Write the founders list (mutates), each founder tagged with the line's
 * source. Null when the key isn't the list, so the caller tries the next
 * product; `founders.howTheyMet` and `founders.capTable` are plain text cells.
 */
export function applyFoundersField(
  form: FoundersForm,
  key: string,
  value: unknown,
  source: FieldSource,
): boolean | null {
  if (key !== "founders") return null;
  form.founders.members = normalizeFounders(value).map((f) => ({ ...f, source }));
  return true;
}
