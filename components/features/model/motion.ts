import type { CSSProperties } from "react";

/** Stagger for one piece of a chart's entrance; read by the `.r-*` classes. */
export const delay = (ms: number) => ({ "--d": `${Math.round(ms)}ms` }) as CSSProperties;
