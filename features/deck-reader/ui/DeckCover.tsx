"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { PdfSource } from "@/lib/analyses/pdf-source";
import { loadCover } from "./cover";
import { useNearViewport } from "./hooks";

/**
 * A deck's cover page, filling its parent. Nothing loads until it comes near
 * the viewport. Shows `fallback` when there's no PDF or the page can't be
 * drawn. Memoise `source`: a new object reloads the cover.
 */
export default function DeckCover({
  source,
  page = 1,
  alt,
  fallback,
}: {
  source: PdfSource | null;
  page?: number;
  alt: string;
  fallback: ReactNode;
}) {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  // Tagged with the deck and page it's for, so a new source never shows the old image.
  const [cover, setCover] = useState<{ for: string; url: string | null } | null>(null);
  const wanted = source ? `${source.key}:${page}` : null;

  useEffect(() => {
    if (!source || !near) return;
    let live = true;
    const tag = `${source.key}:${page}`;
    loadCover(source, page).then((url) => {
      if (live) setCover({ for: tag, url });
    });
    return () => {
      live = false;
    };
  }, [source, page, near]);

  const url = cover?.for === wanted ? cover.url : undefined;

  return (
    <div ref={ref} className="absolute inset-0">
      {!source || url === null ? (
        fallback
      ) : url ? (
        // Blob URLs made in the browser; next/image has nothing to optimise here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} draggable={false} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full animate-pulse bg-ink/[0.06]" />
      )}
    </div>
  );
}
