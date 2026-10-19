"use client";

import { useState } from "react";
import { Row, Skeleton } from "@/components/report/Row";
import { SourcePicker } from "@/components/report/SourcePicker";
import { EditableText } from "@/components/report/EditableText";
import { SlideChips, type SlideHref } from "@/components/report/SlideChips";
import { founderSource, MAX_FOUNDERS } from "../form";
import type { Founder, FoundersForm } from "../types";

const BLANK_FOUNDER: Founder = { role: "", name: "", commitment: "", background: [], source: "personal" };

/**
 * One report row per founder: role, name, commitment and background, with
 * where it came from. With `onChange`, every part can be edited, founders added
 * and removed; the whole list is handed back on each change, and a founder
 * whose text was edited becomes "personal".
 */
export default function FoundersRows({
  form,
  active,
  evidence,
  slideHref,
  onChange,
}: {
  form: FoundersForm;
  active: boolean;
  /** The deck slides the founders list was read from. */
  evidence?: number[];
  /** Links a slide to the Deck page; without it, no slides are shown. */
  slideHref?: SlideHref;
  onChange?: (members: Founder[]) => void;
}) {
  const members = form.founders.members;
  const [adding, setAdding] = useState(false);

  const update = (i: number, patch: Partial<Founder>) => {
    if (!onChange) return;
    // A text edit makes the founder the person's own; a source pick is just that.
    const source = patch.source ?? "personal";
    onChange(members.map((m, j) => (j === i ? { ...m, ...patch, source } : m)));
  };
  const remove = (i: number) => onChange?.(members.filter((_, j) => j !== i));

  const addRow = onChange && !active && members.length < MAX_FOUNDERS && (
    <Row label={<span className="font-normal text-ink/40">New founder</span>}>
      {adding ? (
        <EditableText
          value=""
          label="New founder's name"
          multiline={false}
          initiallyEditing
          onSave={(name) => name && onChange([...members, { ...BLANK_FOUNDER, name }])}
          onDone={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-ink/20 px-2.5 py-0.5 text-xs font-medium text-ink/55 transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          + Add founder
        </button>
      )}
    </Row>
  );

  if (members.length === 0) {
    return (
      <>
        <Row label="Founders">
          <Skeleton active={active} />
        </Row>
        {addRow}
      </>
    );
  }

  const editable = onChange && !active;
  return (
    <>
      {members.map((m, i) => {
        const source = founderSource(m, evidence);
        const chips =
          source === "deck" && evidence?.length && slideHref ? (
            <SlideChips slides={evidence} slideHref={slideHref} inline />
          ) : null;

        if (!editable) {
          return (
            <Row key={i} label={m.role || "Founder"}>
              <div className="cell-pop space-y-1">
                <div className="font-semibold text-ink">
                  {m.name}
                  {source && <SourcePicker source={source} />}
                  {chips}
                </div>
                {m.commitment && <div className="text-xs italic text-muted">{m.commitment}</div>}
                {m.background.length > 0 && (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink/80">
                    {m.background.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            </Row>
          );
        }

        return (
          <Row
            key={i}
            label={
              <EditableText value={m.role} label="Role" multiline={false} placeholder="Founder" onSave={(role) => update(i, { role })} />
            }
          >
            <div className="group/founder relative space-y-1 pr-6">
              <div className="font-semibold text-ink">
                <EditableText value={m.name} label="Name" multiline={false} placeholder="add name" onSave={(name) => update(i, { name })} />
                <SourcePicker source={source ?? "unknown"} onChange={(s) => update(i, { source: s })} />
                {chips}
              </div>
              <div className="text-xs italic text-muted">
                <EditableText
                  value={m.commitment}
                  label="Commitment"
                  multiline={false}
                  placeholder="add commitment"
                  onSave={(commitment) => update(i, { commitment })}
                />
              </div>
              <div className="text-ink/80">
                <EditableText
                  block
                  value={m.background.join("\n")}
                  label="Background, one point per line"
                  placeholder="add background, one point per line"
                  onSave={(text) => update(i, { background: text.split("\n").map((l) => l.trim()).filter(Boolean) })}
                >
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {m.background.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                </EditableText>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${m.name || m.role || "this founder"}`}
                title="Remove founder"
                className="absolute right-0 top-0 rounded-full px-1.5 text-base leading-none text-ink/30 transition-colors hover:bg-ink/5 hover:text-ink/70 focus-visible:outline-2 focus-visible:outline-accent sm:opacity-0 sm:group-hover/founder:opacity-100 sm:focus-visible:opacity-100"
              >
                ×
              </button>
            </div>
          </Row>
        );
      })}
      {addRow}
    </>
  );
}
