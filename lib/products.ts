import { ROUTES } from "./routes";

/**
 * The pages an analysis has: one per product, in sidebar order, plus the whole
 * report on one page at the end. Each lives at
 * `/dashboard/analyses/<id>/<slug>`; the analysis's overview is the bare
 * `/dashboard/analyses/<id>`.
 *
 * Plain data, no React, so the route can check a slug on the server. What each
 * page shows, and how its status is worked out, is the client registry in
 * `components/features/analyze/productTabs.tsx`, keyed by these slugs.
 */
export const PRODUCT_PAGES = [
  {
    slug: "deck",
    label: "Deck",
    description: "Every slide, read off the PDF and linked to the answers it gave.",
  },
  {
    slug: "memo",
    label: "Memo",
    description: "The due-diligence memo, filled in from the deck and the web.",
  },
  {
    slug: "founders",
    label: "Founders",
    description: "Who's building it, how they met, and who owns what.",
  },
  {
    slug: "research",
    label: "Research",
    description: "What the web says about the gaps the deck left.",
  },
  {
    slug: "landscape",
    label: "Landscape",
    description: "The competitors, mapped on the two axes that matter most.",
  },
  {
    slug: "scorecard",
    label: "Scorecard",
    description: "Six 1–5 ratings and the invest or pass call they lead to.",
  },
  {
    slug: "feedback",
    label: "Feedback",
    description: "What the deck does well, and what to fix before the next pitch.",
  },
  {
    slug: "report",
    label: "Full report",
    description: "Everything above, on one page.",
  },
] as const;

export type ProductSlug = (typeof PRODUCT_PAGES)[number]["slug"];
export type ProductPage = (typeof PRODUCT_PAGES)[number];

export function isProductSlug(value: string): value is ProductSlug {
  return PRODUCT_PAGES.some((p) => p.slug === value);
}

export function productPage(slug: ProductSlug): ProductPage {
  return PRODUCT_PAGES.find((p) => p.slug === slug)!;
}

/** The product page `pathname` is on, or null on an analysis's overview (or outside one). */
export function productSlugOf(pathname: string): ProductSlug | null {
  if (!pathname.startsWith(`${ROUTES.analyses}/`)) return null;
  const segment = pathname.slice(ROUTES.analyses.length + 1).split("/")[1] ?? "";
  return isProductSlug(segment) ? segment : null;
}
