import { Row, Skeleton } from "@/components/report/Row";
import type { FoundersForm } from "../types";

/** One report row per founder: role, name, commitment and background. */
export default function FoundersRows({ form, active }: { form: FoundersForm; active: boolean }) {
  const members = form.founders.members;
  if (members.length === 0) {
    return (
      <Row label="Founders">
        <Skeleton active={active} />
      </Row>
    );
  }
  return (
    <>
      {members.map((m, i) => (
        <Row key={i} label={m.role || "Founder"}>
          <div className="cell-pop space-y-1">
            <div className="font-semibold text-ink">{m.name}</div>
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
      ))}
    </>
  );
}
