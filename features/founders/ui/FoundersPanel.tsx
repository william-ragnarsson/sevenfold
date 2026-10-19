import { Row, Skeleton } from "@/components/report/Row";
import { SourceBadge, SourceLegend } from "@/components/report/SourceBadge";
import { SlideChips, type SlideHref } from "@/components/report/SlideChips";
import type { Field } from "@/lib/core/types";
import { FOUNDERS_SECTION } from "../form";
import type { FoundersForm } from "../types";
import FoundersRows from "./FoundersRows";

/** A text cell of the section: its value and where it came from, or a placeholder. */
function TextRow({
  label,
  field,
  active,
  slides,
  slideHref,
}: {
  label: string;
  field: Field;
  active: boolean;
  slides?: number[];
  slideHref?: SlideHref;
}) {
  return (
    <Row label={label}>
      {field.value ? (
        <span key={field.value} className="cell-pop">
          <span className="whitespace-pre-wrap text-ink/90">{field.value}</span>
          <SourceBadge source={field.source} />
          {field.source === "deck" && slides?.length && slideHref ? (
            <SlideChips slides={slides} slideHref={slideHref} inline />
          ) : null}
        </span>
      ) : (
        <Skeleton active={active} />
      )}
    </Row>
  );
}

/**
 * The Founders page: who's building it, how they know each other and how the
 * company is owned, in the memo's grid style. The same cells appear in the
 * memo, where they can be edited; this is them on their own.
 */
export default function FoundersPanel({
  form,
  active,
  evidence,
  slideHref,
}: {
  form: FoundersForm;
  active: boolean;
  /** Field key → the deck slides its value was read from. */
  evidence?: Record<string, number[]>;
  /** Links a slide to the Deck page; without it, no slides are shown. */
  slideHref?: SlideHref;
}) {
  const labelOf = (key: string) => FOUNDERS_SECTION.fields.find((f) => f.key === key)?.label ?? key;
  const textRow = (key: "founders.howTheyMet" | "founders.capTable", field: Field) => (
    <TextRow label={labelOf(key)} field={field} active={active} slides={evidence?.[key]} slideHref={slideHref} />
  );
  return (
    <div className="overflow-hidden rounded-3xl border border-ink/15 bg-white/60 shadow-sm backdrop-blur">
      <div className="border-b border-ink/10 px-4 py-3">
        <p className="text-sm font-semibold text-ink">The team behind the deck, and who owns what.</p>
        <p className="mt-0.5 text-xs text-muted">Read off the slides first, then filled in from the web.</p>
      </div>
      <SourceLegend />
      <div className="bg-ink px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-paper">
        {FOUNDERS_SECTION.title}
      </div>
      <FoundersRows form={form} active={active} evidence={evidence?.founders} slideHref={slideHref} />
      {textRow("founders.howTheyMet", form.founders.howTheyMet)}
      {textRow("founders.capTable", form.founders.capTable)}
    </div>
  );
}
