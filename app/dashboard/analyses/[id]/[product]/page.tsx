import { notFound } from "next/navigation";
import ProductView from "@/components/features/analyze/ProductView";
import { isProductSlug } from "@/lib/products";

/** One product's page of an analysis — `lib/products.ts` lists the slugs. */
export default async function AnalysisProductPage({ params }: { params: Promise<{ id: string; product: string }> }) {
  const { product } = await params;
  if (!isProductSlug(product)) notFound();
  return <ProductView slug={product} />;
}
