import { emptyField, type FormSection } from "@/lib/core/schema";
import type { MemoForm } from "./types";

/**
 * The memo's fields: the written sections of the DD template. The company
 * overview opens the report; the rest follow the founders.
 */

export const COMPANY_SECTION: FormSection = {
  title: "Company Overview",
  fields: [
    { key: "company.name", label: "Company", kind: "text", hint: "The company / startup name." },
    { key: "company.source", label: "Source", kind: "text", manualOnly: true, hint: "How the investor met the company (e.g. an event). Usually not in the deck - leave unknown if absent." },
    { key: "company.founded", label: "Founded", kind: "text", hint: "Founding date (month + year if known)." },
    { key: "company.basedIn", label: "Based in", kind: "text", hint: "Headquarters location (city/country)." },
    { key: "company.description", label: "Description", kind: "text", hint: "1-3 sentence description of what the company does." },
    { key: "company.personalNote", label: "Personal note", kind: "text", manualOnly: true, hint: "The investor's subjective impression from meeting the team. Not derivable from a deck - leave unknown." },
  ],
};

/** The written sections that follow the founders, in report order. */
export const MEMO_SECTIONS: FormSection[] = [
  {
    title: "Team",
    fields: [
      { key: "team.headcount", label: "Headcount", kind: "text", hint: "Team size / composition (e.g. '3 founders, 2 FT 1 PT')." },
      { key: "team.runway", label: "Runway", kind: "text", hint: "Funding runway and next-round timing." },
    ],
  },
  {
    title: "Problem",
    fields: [
      { key: "problem.core", label: "Core problem", kind: "text", hint: "The core problem the company solves." },
      { key: "problem.insight", label: "Insight / Origin", kind: "text", hint: "The founding insight or origin story behind the problem." },
    ],
  },
  {
    title: "Solution",
    fields: [
      { key: "solution.core", label: "Core solution", kind: "text", hint: "The core product/solution." },
      { key: "solution.defensibility", label: "Defensibility", kind: "text", hint: "Moat / defensibility (IP, tech, data, network effects)." },
    ],
  },
  {
    title: "Other",
    fields: [
      { key: "market.gtm", label: "GTM", kind: "text", hint: "Go-to-market: target customers and channels." },
      { key: "market.revenueModel", label: "Revenue Model", kind: "text", hint: "How they make money; pricing; any revenue caveats." },
      { key: "market.traction", label: "Traction", kind: "text", hint: "Customers, revenue, pilots, LOIs, pipeline." },
      { key: "market.competitiveLandscape", label: "Competitive Landscape", kind: "text", hint: "Competitors and how they differentiate." },
      { key: "market.technologicalApplication", label: "Technological Application", kind: "text", hint: "The underlying technology and how it's applied." },
    ],
  },
];

/** The memo with every field unfilled. */
export function emptyMemoForm(): MemoForm {
  return {
    company: {
      name: emptyField(),
      source: emptyField(),
      founded: emptyField(),
      basedIn: emptyField(),
      description: emptyField(),
      personalNote: emptyField(),
    },
    team: { headcount: emptyField(), runway: emptyField() },
    problem: { core: emptyField(), insight: emptyField() },
    solution: { core: emptyField(), defensibility: emptyField() },
    market: {
      gtm: emptyField(),
      revenueModel: emptyField(),
      traction: emptyField(),
      competitiveLandscape: emptyField(),
      technologicalApplication: emptyField(),
    },
  };
}
