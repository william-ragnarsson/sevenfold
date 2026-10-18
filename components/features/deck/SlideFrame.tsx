"use client";

import type { SlideStatus, SlideView } from "@/lib/deck";

/** Unread pages sit grey and dim, then come up in colour once the reader has passed. */
const IMAGE: Record<SlideStatus, string> = {
  pending: "opacity-40 grayscale",
  reading: "opacity-90 grayscale-[0.4]",
  read: "",
  blank: "",
  unmapped: "",
};

/** A field just found on this slide, shown as a chip over it while it glows. */
export interface FrameFinding {
  /** Changes for each new find, so the glow replays. */
  id: string;
  label: string | null;
}

/**
 * One page of the deck, thumbnail-sized: its image (or its number), an accent
 * ring while it's being read, and a glow when a field is found on it.
 */
export default function SlideFrame({
  view,
  image,
  aspect,
  animate,
  found,
}: {
  view: SlideView;
  /** Page image URL, or null to show the page number instead. */
  image: string | null;
  /** Width over height of the deck's pages. */
  aspect: number;
  /** Whether to play the glow on a find (a live run, motion allowed). */
  animate: boolean;
  found: FrameFinding | null;
}) {
  const { index, status } = view;

  return (
    <div
      className={`relative overflow-hidden rounded-lg border bg-paper-2 ${
        status === "reading" ? "border-accent ring-2 ring-accent/25" : "border-ink/10"
      }`}
      style={{ aspectRatio: aspect }}
    >
      {image ? (
        // Blob URLs made in the browser; next/image has nothing to optimise here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          draggable={false}
          className={`absolute inset-0 h-full w-full object-contain ${IMAGE[status]}`}
        />
      ) : (
        <span
          className={`absolute inset-0 grid place-items-center font-serif text-4xl tabular-nums ${
            status === "pending" ? "text-ink/15" : "text-ink/35"
          }`}
        >
          {index}
        </span>
      )}

      {animate && found && (
        <span key={found.id} aria-hidden>
          <span className="slide-found" />
          {found.label && (
            <span className="pop-in absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white shadow-md">
              Found · {found.label}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
