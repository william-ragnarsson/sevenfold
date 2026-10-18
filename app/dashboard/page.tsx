import DashboardHome from "@/components/features/analyze/DashboardHome";

/** Where the dashboard opens: a dropzone for the next deck, then how the last ones went. */
export default function DashboardPage() {
  return (
    // The wider gutter from lg up leaves room for the dropzone's sample sticker,
    // which hangs 2rem past its right edge there.
    <div className="mx-auto max-w-6xl px-6 pt-10 pb-24 lg:px-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-1 text-muted">Drop a pitch deck to analyse it, or pick up where you left off.</p>
      </header>
      <DashboardHome />
    </div>
  );
}
