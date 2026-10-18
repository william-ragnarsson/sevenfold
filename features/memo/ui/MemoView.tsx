"use client";

import { Fragment, type ReactNode } from "react";
import { Row, Skeleton } from "@/components/report/Row";
import { SourceBadge, SourceLegend } from "@/components/report/SourceBadge";
import { DOC_SECTIONS, readField, sectionSlug, type FieldDescriptor, type FieldKind } from "@/lib/diligence/form-schema";
import type { DueDiligenceForm } from "@/lib/diligence/types";

/**
 * Draws the fields of one kind (other than text) — the founders list, say. The
 * product that owns the kind supplies it, so the memo doesn't import it.
 */
export type FieldRenderer = (props: { descriptor: FieldDescriptor; form: DueDiligenceForm; active: boolean }) => ReactNode;

/** The value side of one text row, with live skeleton / fill states. */
function FieldValue({
  descriptor,
  form,
  active,
}: {
  descriptor: FieldDescriptor;
  form: DueDiligenceForm;
  active: boolean;
}) {
  const field = readField(form, descriptor.key);
  if (field && field.value) {
    return (
      <span key={field.value} className="cell-pop">
        <span className="whitespace-pre-wrap text-ink/90">{field.value}</span>
        <SourceBadge source={field.source} />
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
 */
export default function MemoView({
  form,
  active = false,
  renderers = {},
}: {
  form: DueDiligenceForm;
  active?: boolean;
  renderers?: Partial<Record<FieldKind, FieldRenderer>>;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-ink/15 bg-white/60 shadow-sm backdrop-blur">
      <div className="border-b border-ink/10 px-4 py-3">
        <p className="text-sm font-semibold text-ink">
          The due-diligence memo, the same worksheet a VC fills in.
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Watch where each answer comes from - a summary could only ever show &ldquo;deck&rdquo;.
        </p>
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
                  <FieldValue descriptor={f} form={form} active={active} />
                </Row>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
