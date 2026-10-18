import type { FieldSource } from "@/lib/core/types";

/**
 * Where a cell's value came from, as a small badge. Shared by every product
 * that shows filled-in fields, so `deck` / `web` / `inference` look the same
 * everywhere.
 */

const SOURCE_BADGE: Record<FieldSource, { label: string; cls: string; legend: string } | null> = {
  deck: { label: "deck", cls: "bg-accent/15 text-accent", legend: "straight from your slides" },
  web: { label: "web", cls: "bg-blue-500/15 text-blue-700", legend: "dug up beyond your deck" },
  inferred: { label: "inference", cls: "bg-amber-500/20 text-amber-700", legend: "the AI's own read" },
  unknown: null,
};

export function SourceBadge({ source }: { source: FieldSource }) {
  const badge = SOURCE_BADGE[source];
  if (!badge) return null;
  return (
    <span className={`ml-2 rounded px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

/** Legend for the badges above, so a `web`/`inferred` cell reads as proof — not decoration. */
export function SourceLegend() {
  const entries = (Object.entries(SOURCE_BADGE) as [FieldSource, { label: string; cls: string; legend: string } | null][])
    .filter(([, badge]) => badge !== null) as [FieldSource, { label: string; cls: string; legend: string }][];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-ink/10 bg-paper-2/40 px-4 py-2.5 text-xs text-muted">
      {entries.map(([source, badge]) => (
        <span key={source} className="inline-flex items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}>
            {badge.label}
          </span>
          {badge.legend}
        </span>
      ))}
    </div>
  );
}
