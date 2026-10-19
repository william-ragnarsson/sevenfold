import { notFound } from "next/navigation";
import ProductView from "@/components/features/analyze/ProductView";
import { isProductSlug } from "@/lib/products";
import { SLIDE_PARAM, slideFromParam } from "@/lib/routes";

/** One product's page of an analysis — `lib/products.ts` lists the slugs. */
export default async function AnalysisProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; product: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { product } = await params;
  if (!isProductSlug(product)) notFound();
  // `?slide=4` opens the Deck section at that slide (feedback items link here).
  const slide = slideFromParam((await searchParams)[SLIDE_PARAM]);
  return <ProductView slug={product} slide={slide} />;
}
