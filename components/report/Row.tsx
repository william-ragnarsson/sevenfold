import type { ReactNode } from "react";

/** One label/value row of a report grid. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] divide-x divide-ink/10 border-b border-ink/10 last:border-b-0 sm:grid-cols-[160px_1fr]">
      <div className="bg-paper-2/40 px-4 py-3 text-sm font-semibold text-ink/75">{label}</div>
      <div className="px-4 py-3 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

/** A cell still waiting for its value: a pulsing bar while the run is live, a dash after. */
export function Skeleton({ active }: { active: boolean }) {
  if (!active) return <span className="text-ink/30">-</span>;
  return <span className="inline-block h-3 w-28 animate-pulse rounded bg-ink/10 align-middle" />;
}
