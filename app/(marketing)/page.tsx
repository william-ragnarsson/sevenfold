import Hero from "@/components/features/hero/Hero";
import PitchPerspective from "@/components/features/landing/PitchPerspective";
import InvestModel from "@/components/features/landing/InvestModel";
import ClosingCta from "@/components/features/landing/ClosingCta";

/**
 * Layout rule for this page — sheets on the dot grid:
 *
 * Every section sits on a solid sheet, so no text lands on the bare dot grid,
 * and the strips of grid left between the sheets are what divide one section
 * from the next. The hero is the dark sheet; the rest are `Sheet`s in
 * `bg-sheet`, and the footer is the last, slimmer one (`Footer`'s `sheet`).
 *
 * The sheets share the hero card's inset and radius, and the gaps between them
 * match that inset (12px, 24px from `sm`). Sections boxed in cards of mixed
 * widths and shapes are what made an earlier version of this page incoherent;
 * one shape repeated down the page is what keeps this one from it.
 *
 * A *product artifact* — the deal log beside InvestModel, the feedback cards in
 * PitchPerspective, the closing dropzone — is framed in white on its sheet.
 * That is content, not section chrome.
 *
 * Widths: content inside every sheet is max-w-6xl. Text blocks cap themselves
 * internally rather than by changing the container.
 */
export default function Home() {
  return (
    <div>
      <div className="p-3 sm:p-6">
        <Hero />
      </div>

      {/* The model leads: how it was trained and how often it agrees with a
          real VC is the hook, and it links on to /model for the full story. */}
      <Sheet className="py-20 sm:py-28">
        <InvestModel />
      </Sheet>

      <Sheet className="py-20 sm:py-28">
        <PitchPerspective />
      </Sheet>

      {/* Asymmetric: the run button and the assurances under it are light, low
          elements, so an equal bottom padding leaves a visible void before the
          sheet's edge. */}
      <Sheet className="pb-16 pt-20 sm:pb-24 sm:pt-28">
        <ClosingCta />
      </Sheet>
    </div>
  );
}

/** One section's sheet: the hero card's inset and radius, in light paper. */
function Sheet({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div className="px-3 pb-3 sm:px-6 sm:pb-6">
      <div className="rounded-[40px] border border-ink/[0.09] bg-sheet shadow-[0_1px_2px_rgba(20,19,15,0.04),0_24px_48px_-32px_rgba(20,19,15,0.25)]">
        <div className={"mx-auto max-w-6xl px-6 " + className}>{children}</div>
      </div>
    </div>
  );
}
