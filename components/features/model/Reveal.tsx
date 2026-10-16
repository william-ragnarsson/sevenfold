"use client";

import { useEffect, useRef } from "react";

/**
 * Plays a chart's entrance once it scrolls into view, by setting `data-shown`.
 * The CSS in globals.css does the rest (`.r-grow-x`, `.r-pop`, …), so the
 * charts themselves stay server components and only this wrapper ships JS.
 *
 * The attribute is written straight to the node rather than through state:
 * nothing re-renders, and a slow hydration can't flash the chart twice.
 */
export default function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        node.dataset.shown = "";
        observer.disconnect();
      },
      // Same as OutputCardStack: threshold 0 plus a bottom inset, because a
      // fractional threshold can't be met by a chart taller than the viewport.
      { threshold: 0, rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={"reveal " + className}>
      {children}
    </div>
  );
}
