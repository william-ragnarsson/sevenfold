import AnalysisWorkspace from "@/components/features/analyze/AnalysisWorkspace";

/** Every deck analysed under this account, and the dropzone to add another. */
export default function AnalysesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 pt-10 pb-24">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-ink">Analyses</h1>
      <AnalysisWorkspace />
    </div>
  );
}
