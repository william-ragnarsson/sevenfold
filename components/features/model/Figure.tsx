import type { ReactNode } from "react";
import Reveal from "@/components/features/model/Reveal";

/**
 * One chart on /model: the words beside the picture, stacked on phones.
 *
 * `layout` only matters on wide screens, and the page varies it so the charts
 * don't all sit on the same side: "left" puts the words left of the chart,
 * "right" puts them right of it, "stacked" sets them above a full-width chart.
 * Phones always read words first, then the chart.
 *
 * Every chart has exactly one `takeaway`, the sentence a reader who skips the
 * chart should still leave with. `label` is the same idea for screen readers,
 * which get it instead of the chart's individual dots and bars. Leave it out
 * only for a chart with controls, which labels its own picture, since buttons
 * can't live inside an image.
 */
type Layout = "left" | "right" | "stacked";

const FIGURE: Record<Layout, string> = {
  left: "grid items-center gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14",
  right: "grid items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14",
  stacked: "grid gap-8 lg:gap-10",
};

const CAPTION: Record<Layout, string> = {
  left: "max-w-xl",
  right: "max-w-xl lg:order-2",
  stacked: "max-w-2xl lg:grid lg:max-w-none lg:grid-cols-2 lg:items-end lg:gap-14",
};

export default function Figure({
  title,
  lead,
  takeaway,
  note,
  label,
  layout = "left",
  children,
}: {
  title: ReactNode;
  lead?: ReactNode;
  takeaway: ReactNode;
  note?: ReactNode;
  label?: string;
  layout?: Layout;
  children: ReactNode;
}) {
  return (
    <figure className={FIGURE[layout]}>
      <figcaption className={CAPTION[layout]}>
        <div>
          <h3 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h3>
          {lead && <p className="mt-3 leading-relaxed text-muted">{lead}</p>}
        </div>
        <div>
          <p className="mt-4 flex gap-3 font-medium leading-relaxed text-ink">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>{takeaway}</span>
          </p>
          {note && <p className="mt-4 text-sm leading-relaxed text-muted/80">{note}</p>}
        </div>
      </figcaption>

      <Reveal className="rounded-3xl border border-ink/10 bg-white/50 p-5 backdrop-blur sm:p-7">
        {label ? (
          <div role="img" aria-label={label}>
            {children}
          </div>
        ) : (
          children
        )}
      </Reveal>
    </figure>
  );
}
