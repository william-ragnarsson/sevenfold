"use client";

import { Fragment, type ReactNode } from "react";
import { Row, Skeleton } from "@/components/report/Row";
import { SourceLegend } from "@/components/report/SourceBadge";
import { SourcePicker } from "@/components/report/SourcePicker";
import { EditableText } from "@/components/report/EditableText";
import { SlideChips, type SlideHref } from "@/components/report/SlideChips";
import type { FieldSource } from "@/lib/core/types";
import { DOC_SECTIONS, readField, sectionSlug, type FieldDescriptor, type FieldKind } from "@/lib/diligence/form-schema";
import type { DueDiligenceForm } from "@/lib/diligence/types";

/**
 * Draws the fields of one kind (other than text) — the founders list, say. The
 * product that owns the kind supplies it, so the memo doesn't import it.
 */
export type FieldRenderer = (props: { descriptor: FieldDescriptor; form: DueDiligenceForm; active: boolean }) => ReactNode;

/** A person's change to one text cell: its value, its source, or both. */
export type MemoFieldChange = { value?: string; source?: FieldSource };

/** The value side of one text row, with live skeleton / fill states. */
function FieldValue({
  descriptor,
  form,
  active,
  slides,
  slideHref,
  onEdit,
}: {
  descriptor: FieldDescriptor;
  form: DueDiligenceForm;
  active: boolean;
  slides?: number[];
  slideHref?: SlideHref;
  onEdit?: (change: MemoFieldChange) => void;
}) {
  const field = readField(form, descriptor.key);
  const value = field?.value ?? "";
  // The slides a deck value was read from. A value edited away from the deck
  // hides them; switching its badge back to deck shows them again.
  const chips =
    field?.source === "deck" && slides?.length && slideHref ? (
      <SlideChips slides={slides} slideHref={slideHref} inline />
    ) : null;

  if (onEdit && !(active && !value)) {
    return (
      <span key={value} className={value ? "cell-pop" : undefined}>
        <EditableText
          value={value}
          label={descriptor.label}
          placeholder={descriptor.manualOnly ? "add manually" : "add"}
          onSave={(next) => onEdit({ value: next })}
        >
          <span className="whitespace-pre-wrap text-ink/90">{value}</span>
        </EditableText>
        {value && <SourcePicker source={field!.source} onChange={(source) => onEdit({ source })} />}
        {value && chips}
      </span>
    );
  }
  if (value) {
    return (
      <span key={value} className="cell-pop">
        <span className="whitespace-pre-wrap text-ink/90">{value}</span>
        <SourcePicker source={field!.source} />
        {chips}
      </span>
    );
  }
  if (descriptor.manualOnly) {
    return <span className="text-sm italic text-ink/30">add manually</span>;
  }
  return <Skeleton active={active} />;
}

/**
 * The due-diligence memo, rendered as the PDF-style grid (black section bars,
 * label/value cells). Cells fill in live as `field` events arrive. Fields of a
 * kind listed in `renderers` are drawn by that renderer instead of a text row.
 * With `onEditField`, every text cell can be edited in place and its badge
 * changed; without it the memo is read-only.
 */
export default function MemoView({
  form,
  active = false,
  renderers = {},
  evidence,
  slideHref,
  onEditField,
  toolbar,
}: {
  form: DueDiligenceForm;
  active?: boolean;
  renderers?: Partial<Record<FieldKind, FieldRenderer>>;
  /** Field key → the deck slides its value was read from. */
  evidence?: Record<string, number[]>;
  /** Links a slide to the Deck page; without it, no slides are shown. */
  slideHref?: SlideHref;
  onEditField?: (key: string, change: MemoFieldChange) => void;
  /** Shown at the right of the header: the export button, say. */
  toolbar?: ReactNode;
}) {
  return (
    <div className="max-w-4xl overflow-hidden rounded-3xl border border-ink/15 bg-white/60 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-ink/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            The due-diligence memo, the same worksheet a VC fills in.
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {onEditField
              ? "Click any answer to edit it, or its badge to say where it came from."
              : "Watch where each answer comes from - a summary could only ever show “deck”."}
          </p>
        </div>
        {toolbar && <div className="flex shrink-0 items-center gap-2">{toolbar}</div>}
      </div>
      <SourceLegend />
      {DOC_SECTIONS.map((section) => (
        <section key={section.title} id={sectionSlug(section.title)} className="scroll-mt-24">
          <div className="bg-ink px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-paper">
            {section.title}
          </div>
          <div>
            {section.fields.map((f) => {
              const render = renderers[f.kind];
              return render ? (
                <Fragment key={f.key}>{render({ descriptor: f, form, active })}</Fragment>
              ) : (
                <Row key={f.key} label={f.label}>
                  <FieldValue
                    descriptor={f}
                    form={form}
                    active={active}
                    slides={evidence?.[f.key]}
                    slideHref={slideHref}
                    onEdit={onEditField && ((change) => onEditField(f.key, change))}
                  />
                </Row>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
