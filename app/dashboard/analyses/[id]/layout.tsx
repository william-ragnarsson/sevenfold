import type { ReactNode } from "react";
import AnalysisFrame from "@/components/features/analyze/AnalysisFrame";

/**
 * One analysis: its overview and a page per product. The id isn't checked
 * here — reports imported from the old browser history are keyed by whatever
 * id they had, and the frame says so when there's nothing under it.
 */
export default function AnalysisLayout({ children }: { children: ReactNode }) {
  return <AnalysisFrame>{children}</AnalysisFrame>;
}
