"use client";

import type { SlideStatus, SlideView } from "./selectors";

/** Unread pages sit grey and dim, then come up in colour once the reader has passed. */
const IMAGE: Record<SlideStatus, string> = {
  pending: "opacity-40 grayscale",
  reading: "opacity-90 grayscale-[0.4]",
  read: "",
  blank: "",
  unmapped: "",
};

/**
 * One page of the deck: its image (an empty frame until it's drawn, or when
 * there's none), an accent edge while it's being read, and a glow when a field
 * is found on it.
 */
export default function SlideFrame({
  view,
  image,
  aspect,
  found = null,
}: {
  view: SlideView;
  /** Page image URL, or null for an empty frame. */
  image: string | null;
  /** Width over height of the deck's pages. */
  aspect: number;
  /** Set while a field just found on this slide glows; a new value replays it. */
  found?: string | null;
}) {
  const { status } = view;

  return (
    <div
      className={`relative overflow-hidden rounded-lg border bg-paper-2 ${
        status === "reading" ? "border-accent" : "border-ink/10"
      }`}
      style={{ aspectRatio: aspect }}
    >
      {image && (
        // Blob URLs made in the browser; next/image has nothing to optimise here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          draggable={false}
          className={`absolute inset-0 h-full w-full object-contain ${IMAGE[status]}`}
        />
      )}
      {found && <span key={found} aria-hidden className="slide-found" />}
    </div>
  );
}
