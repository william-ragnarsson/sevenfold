import Link from "next/link";
import type { AnalysisSummary } from "@/lib/analyses/store";
import { analysisPath } from "@/lib/routes";
import AnalysisStatusBadge from "./AnalysisStatusBadge";
import DeleteAnalysisButton from "./DeleteAnalysisButton";
import { relativeTime } from "./elapsed";

/** A saved analysis as one line of a list: name, where it stands, when it ran. Render inside a `<ul>`. */
export default function AnalysisRow({ record, onDelete }: { record: AnalysisSummary; onDelete?: () => void }) {
  const name = record.name || "Untitled deck";

  return (
    <li className="flex items-center">
      <Link
        href={analysisPath(record.id)}
        className="flex min-w-0 flex-1 items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-paper-2"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-ink">{name}</span>
          <AnalysisStatusBadge record={record} />
        </span>
        <span className="shrink-0 text-sm text-muted">{relativeTime(record.generatedAt)}</span>
      </Link>
      {onDelete && <DeleteAnalysisButton name={name} onDelete={onDelete} className="mr-2" />}
    </li>
  );
}
