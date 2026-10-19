import type { Field } from "@/lib/core/types";

/**
 * The memo: the written sections of William's Plug-and-Play DD template, one
 * `{ value, source }` cell per line of it. The founders and the scorecard sit
 * between and after these in the report, but belong to their own products.
 */
export interface MemoForm {
  company: {
    name: Field;
    source: Field;
    founded: Field;
    basedIn: Field;
    description: Field;
    personalNote: Field;
  };
  team: {
    headcount: Field;
    runway: Field;
  };
  problem: {
    core: Field;
    insight: Field;
  };
  solution: {
    core: Field;
    defensibility: Field;
  };
  market: {
    gtm: Field;
    revenueModel: Field;
    traction: Field;
    competitiveLandscape: Field;
    technologicalApplication: Field;
  };
}
