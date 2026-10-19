"use client";

import type { FieldSource } from "@/lib/core/types";
import { BADGE_TEXT, SOURCE_BADGE, SourceBadge } from "./SourceBadge";

/** The sources a person can pick for a value. "unknown" isn't one: an empty cell has no source. */
const CHOICES: FieldSource[] = ["deck", "web", "inferred", "personal"];

const capitalized = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A value's source badge that can be changed. Without `onChange` it's the plain
 * `SourceBadge`. With it, a native select sits invisibly over the badge, so the
 * menu is the browser's own (never clipped by the grid, and works by keyboard
 * and on phones).
 */
export function SourcePicker({
  source,
  onChange,
}: {
  source: FieldSource;
  onChange?: (source: FieldSource) => void;
}) {
  if (!onChange) return <SourceBadge source={source} />;
  const badge = SOURCE_BADGE[source];
  return (
    <span className="relative ml-2 inline-flex align-middle">
      <select
        aria-label="Where this value came from"
        value={source}
        onChange={(e) => onChange(e.target.value as FieldSource)}
        className="peer absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {source === "unknown" && (
          <option value="unknown" disabled hidden>
            Source
          </option>
        )}
        {CHOICES.map((c) => (
          <option key={c} value={c}>
            {capitalized(SOURCE_BADGE[c]?.label ?? c)}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className={`inline-flex items-center gap-0.5 ${BADGE_TEXT} ${badge?.cls ?? "bg-ink/5 text-ink/40"} transition-[filter] peer-hover:brightness-95 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent`}
      >
        {badge?.label ?? "source"}
        <svg viewBox="0 0 8 8" className="h-1.5 w-1.5 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 2.5 4 5.5 7 2.5" />
        </svg>
      </span>
    </span>
  );
}
