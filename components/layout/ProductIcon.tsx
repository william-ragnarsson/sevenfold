import type { DashboardPageId, ProductId } from "@/lib/routes";

/**
 * One line icon per product and dashboard page, shared by the nav's Products
 * menu and the dashboard sidebar. Drawn in `currentColor`, so each place sets
 * its own tone.
 */
export default function ProductIcon({
  id,
  className = "h-4 w-4",
}: {
  id: ProductId | DashboardPageId;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={"shrink-0 " + className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {id === "due-diligence" && (
        <>
          {/* A page with a magnifier: reading the deck closely. */}
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
          <path d="M14 3v4a1 1 0 0 0 1 1h4v2" />
          <circle cx="16.5" cy="16.5" r="3" />
          <path d="M18.7 18.7 21 21" />
        </>
      )}
      {id === "dashboard" && (
        <>
          {/* Four tiles: the overview. */}
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="4" rx="1.5" />
          <rect x="13" y="10" width="7" height="10" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
        </>
      )}
      {id === "analyses" && (
        <>
          {/* A stack of reports. */}
          <path d="M8 3h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" />
          <path d="M20.5 7v12a2.5 2.5 0 0 1-2.5 2.5H9" />
        </>
      )}
      {id === "model" && (
        <>
          {/* A small network: the invest model. */}
          <circle cx="5" cy="6" r="2" />
          <circle cx="5" cy="18" r="2" />
          <circle cx="19" cy="12" r="2" />
          <path d="M7 6.8 17 11.2M7 17.2 17 12.8M5 8v8" />
        </>
      )}
      {id === "rubric" && (
        <>
          {/* A checklist: the criteria. */}
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" />
        </>
      )}
    </svg>
  );
}
