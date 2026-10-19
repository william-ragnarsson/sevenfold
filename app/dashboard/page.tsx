import DashboardHome from "@/components/features/analyze/DashboardHome";
import NewAnalysisActions from "@/components/features/analyze/NewAnalysisActions";

/** Where the dashboard opens: the account's numbers and its newest analyses, with a button for the next deck. */
export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-10 pb-24 lg:px-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-muted">Your deal flow at a glance.</p>
        </div>
        <NewAnalysisActions />
      </header>
      <DashboardHome />
    </div>
  );
}
