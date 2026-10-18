"use client";

import { useState } from "react";
import { faviconOf } from "@/components/features/analyze/sourceDisplay";
import type { LandscapeCompany } from "@/lib/diligence/types";

/** "Plug and Play" → "PP", "Vrbo" → "V". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/**
 * A company's logo — its site's favicon — or its initials when there's no
 * website or the icon won't load. Many sites only publish a 16px icon;
 * that's drawn at its own size rather than blown up into a blur.
 */
export default function CompanyLogo({ company, className = "h-6 w-6" }: { company: LandscapeCompany; className?: string }) {
  const [failed, setFailed] = useState(false);
  const [tiny, setTiny] = useState(false);
  const src = company.website ? faviconOf(company.website, 128) : null;

  if (!src || failed) {
    return <span className="text-[11px] font-semibold tracking-tight text-ink/60">{initials(company.name)}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      onLoad={(e) => setTiny(e.currentTarget.naturalWidth < 32)}
      className={`${tiny ? "h-4 w-4" : className} shrink-0 rounded-sm object-contain`}
    />
  );
}
