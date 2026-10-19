import AnalysisWorkspace from "@/components/features/analyze/AnalysisWorkspace";
import NewAnalysisActions from "@/components/features/analyze/NewAnalysisActions";

/** Every deck analysed under this account, as cards or a list, with a button for the next one. */
export default function AnalysesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-10 pb-24 lg:px-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Analyses</h1>
          <p className="mt-1 text-muted">Every deck you&apos;ve analysed.</p>
        </div>
        <NewAnalysisActions />
      </header>
      <AnalysisWorkspace />
    </div>
  );
}
