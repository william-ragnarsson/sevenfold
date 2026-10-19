import Link from "next/link";

/** Where a slide opens, or null when it can't be shown. Filled by the report, which knows the Deck page. */
export type SlideHref = (slide: number) => string | null;

/**
 * Slides as chips, each opening that slide on the Deck page. `inline` sits the
 * chips on the line after a value's source badge; otherwise they get a row of
 * their own.
 */
export function SlideChips({ slides, slideHref, inline = false }: { slides: number[]; slideHref: SlideHref; inline?: boolean }) {
  const links = slides.flatMap((slide) => {
    const href = slideHref(slide);
    return href ? [{ slide, href }] : [];
  });
  if (links.length === 0) return null;
  return (
    <span className={inline ? "ml-1.5 inline-flex flex-wrap gap-1 align-middle" : "mt-2 flex flex-wrap gap-1.5"}>
      {links.map(({ slide, href }) => (
        <Link
          key={slide}
          href={href}
          aria-label={`Open slide ${slide} on the Deck page`}
          className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink/60 transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span aria-hidden className="h-2 w-3 rounded-[2px] border border-current opacity-70" />
          Slide {slide}
        </Link>
      ))}
    </span>
  );
}
