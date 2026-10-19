const TONE = {
  /** On a row's plain surface. */
  plain: "text-muted/60 hover:bg-red-500/10 hover:text-red-600",
  /** Over a deck cover, so it needs its own backing. */
  overlay: "bg-paper/90 text-muted shadow-sm backdrop-blur hover:bg-paper hover:text-red-600",
};

/** The trash button beside a saved analysis. Deletes at once, with no confirm step. */
export default function DeleteAnalysisButton({
  name,
  onDelete,
  tone = "plain",
  className = "",
}: {
  name: string;
  onDelete: () => void;
  tone?: keyof typeof TONE;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onDelete}
      aria-label={`Delete ${name}`}
      title="Delete"
      className={`shrink-0 rounded-lg p-2 transition-colors ${TONE[tone]} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
