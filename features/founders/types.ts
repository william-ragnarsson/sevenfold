import type { Field, FieldSource } from "@/lib/core/types";

/** One founder row in the cap-table section. */
export interface Founder {
  /** e.g. "CEO", "COO", "CFO". */
  role: string;
  name: string;
  /** e.g. "Full-time | Co-founder & CEO". */
  commitment: string;
  /** Background bullet points. */
  background: string[];
  /**
   * Where this founder came from. Absent on reports saved before founders
   * carried a source.
   */
  source?: FieldSource;
}

/** The founders and how the company is owned. */
export interface FoundersForm {
  founders: {
    members: Founder[];
    howTheyMet: Field;
    capTable: Field;
  };
}
