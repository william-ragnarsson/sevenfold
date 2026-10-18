import { emptyField, type FormSection } from "@/lib/core/schema";
import { str } from "@/lib/core/parse";
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

/**
 * Write the founders list (mutates). Null when the key isn't the list, so the
 * caller tries the next product; `founders.howTheyMet` and `founders.capTable`
 * are plain text cells.
 */
export function applyFoundersField(
  form: FoundersForm,
  key: string,
  value: unknown,
): boolean | null {
  if (key !== "founders") return null;
  form.founders.members = normalizeFounders(value);
  return true;
}
