import type { ReactNode } from "react";
import Reveal from "@/components/features/model/Reveal";

/**
 * One chart on /model: the words beside the picture, stacked on phones.
 *
 * Every chart has exactly one `takeaway`, the sentence a reader who skips the
 * chart should still leave with. `label` is the same idea for screen readers,
 * which get it instead of the chart's individual dots and bars.
 */
export default function Figure({
  title,
  lead,
  takeaway,
  note,
  label,
  children,
}: {
  title: ReactNode;
  lead?: ReactNode;
  takeaway: ReactNode;
  note?: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <figure className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
      <figcaption className="max-w-xl">
        <h3 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h3>
        {lead && <p className="mt-3 leading-relaxed text-muted">{lead}</p>}
        <p className="mt-4 flex gap-3 font-medium leading-relaxed text-ink">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span>{takeaway}</span>
        </p>
        {note && <p className="mt-4 text-sm leading-relaxed text-muted/80">{note}</p>}
      </figcaption>

      <Reveal className="rounded-3xl border border-ink/10 bg-white/50 p-5 backdrop-blur sm:p-7">
        <div role="img" aria-label={label}>
          {children}
        </div>
      </Reveal>
    </figure>
  );
}
