import AnalysisLauncher from "@/components/features/analyze/AnalysisLauncher";

/**
 * The closing ask.
 *
 * Deliberately three elements and no prose. An earlier version explained why you
 * should upload, which put a paragraph between the headline and the only thing
 * on this section you can click. By the time a reader reaches the bottom of the
 * page the argument is already made; what's left is to make the target obvious.
 *
 * So: a short headline, the dropzone as the focal point, and the objections that
 * actually stop an upload (account, storage, scope) answered underneath where
 * they're asked.
 *
 * No container of its own. The full-bleed band in `app/page.tsx` sets it apart,
 * and this heading is the largest type on the page below the hero. A dark slab
 * down here reads as a broken copy of the hero, which is what it replaced.
 */

/** All three are properties of the code, not promises: there's no billing,
 *  the settings page exports and deletes everything, and a run takes one PDF. */
const ASSURANCES = ["Free account", "Export or delete any time", "One PDF, that's it"];

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ClosingCta() {
  return (
    <section className="fade-up flex flex-col items-center text-center">
      <h2 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl">
        See it in action!
      </h2>

      {/* `elevated` makes the dropzone opaque and lifts it off the band, which
          is what the rest of the page uses to mean "this is the object". */}
      <div className="mt-10 w-full max-w-xl">
        <AnalysisLauncher tone="light" align="center" elevated />
      </div>

      <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {ASSURANCES.map((a) => (
          <li key={a} className="flex items-center gap-2 text-sm font-medium text-muted">
            <Check />
            {a}
          </li>
        ))}
      </ul>
    </section>
  );
}
